from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Q
from django.utils import timezone

from courses.models import Enrollment, TeachingAssignment

from .models import TimeSlot, TimetableEntry, TimetableApproval
from .serializers import TimeSlotSerializer, TimetableEntrySerializer


# ---------- role helpers ----------
def is_admin(user):
    return getattr(user, "role", "") == "admin" or bool(getattr(user, "is_staff", False))


def is_teacher(user):
    return getattr(user, "role", "") == "teacher"


# ---------- HOD scoping (mirrors users/views.py) ----------
def _hod_course_ids(user):
    """
    Course IDs that belong to this user's department(s) as HOD.
    Derived from the department's students (same approach as users.views).
    Returns [] if the user is not an HOD of any department.
    """
    from users.models import Department, User
    dept_ids = list(
        Department.objects.filter(hod=user).values_list("id", flat=True)
    )
    if not dept_ids:
        return []
    return list(
        User.objects.filter(role="student", department_id__in=dept_ids)
        .exclude(course__isnull=True)
        .values_list("course_id", flat=True)
        .distinct()
    )


def is_hod(user):
    """True if this user is the HOD of at least one department."""
    from users.models import Department
    return Department.objects.filter(hod=user).exists()


def _assignment_course_id(assignment):
    """Course id of a TeachingAssignment (direct FK, or via its year)."""
    cid = getattr(assignment, "course_id", None)
    if cid:
        return cid
    year = getattr(assignment, "year", None)
    return getattr(year, "course_id", None)


def _can_edit_timetable(user, assignment):
    """
    Admin: any class.
    HOD:   only classes whose course is in their own department.
    """
    if is_admin(user):
        return True
    return _assignment_course_id(assignment) in _hod_course_ids(user)


# ---------- approval helpers ----------
def _class_key(assignment):
    """(year_id, semester) — the class a timetable entry belongs to."""
    return assignment.year_id, assignment.subject.semester


def _get_approval(year_id, semester):
    return TimetableApproval.objects.filter(year_id=year_id, semester=semester).first()


def _ensure_approval(assignment):
    """Get or create the approval row (as draft) for an entry's class."""
    year_id, semester = _class_key(assignment)
    obj, _ = TimetableApproval.objects.get_or_create(
        year_id=year_id,
        semester=semester,
        defaults={
            "course_id": _assignment_course_id(assignment),
            "status": TimetableApproval.Status.DRAFT,
        },
    )
    return obj


def _reset_to_draft(approval):
    approval.status = TimetableApproval.Status.DRAFT
    approval.submitted_by = None
    approval.submitted_at = None
    approval.reviewed_by = None
    approval.reviewed_at = None
    approval.remark = ""
    approval.save()


def _approved_filter(qs):
    """Limit a queryset of TimetableEntry to classes that are APPROVED."""
    pairs = list(
        TimetableApproval.objects
        .filter(status=TimetableApproval.Status.APPROVED)
        .values_list("year_id", "semester")
    )
    if not pairs:
        return qs.none()
    q = Q()
    for yid, sem in pairs:
        q |= Q(assignment__year_id=yid, assignment__subject__semester=sem)
    return qs.filter(q)


# =====================================================
#  TIME SLOTS  (bell schedule)  — admin only (college-wide)
# =====================================================
class TimeSlotListCreate(generics.ListCreateAPIView):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can edit periods.")
        serializer.save()


class TimeSlotDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = TimeSlot.objects.all()
    serializer_class = TimeSlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can edit periods.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can edit periods.")
        instance.delete()


# =====================================================
#  TIMETABLE ENTRIES
# =====================================================
class TimetableListCreate(generics.ListCreateAPIView):
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        qs = TimetableEntry.objects.select_related(
            "assignment", "assignment__course", "assignment__year",
            "assignment__subject", "assignment__teacher", "time_slot",
        )

        scope = params.get("scope")

        # ---- BUILDER: a specific class (Year id + semester) ----
        # used by admin builder and HOD builder; NOT approval-filtered,
        # so the HOD can see her own draft while building.
        year_id = params.get("year")
        semester = params.get("semester")
        if year_id or semester:
            if year_id:
                qs = qs.filter(assignment__year_id=year_id)
            if semester:
                qs = qs.filter(assignment__subject__semester=semester)
            if not is_admin(user) and is_hod(user):
                qs = qs.filter(assignment__course_id__in=_hod_course_ids(user))
            return qs

        # ---- TEACHER: own classes, APPROVED only ----
        if scope == "teacher" or (scope is None and is_teacher(user) and not is_hod(user)):
            return _approved_filter(qs.filter(assignment__teacher=user))

        # ---- STUDENT: from enrollment, fall back to course/year/semester ----
        enrolled_ids = Enrollment.objects.filter(
            student=user
        ).values_list("teaching_assignment_id", flat=True)

        if enrolled_ids:
            return _approved_filter(qs.filter(assignment_id__in=list(enrolled_ids)))

        if user.course_id and user.year and user.semester:
            return _approved_filter(qs.filter(
                assignment__course=user.course,
                assignment__year__year_number=user.year,
                assignment__subject__semester=user.semester,
            ))

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user

        assignment = serializer.validated_data["assignment"]
        day = serializer.validated_data["day_of_week"]
        slot = serializer.validated_data["time_slot"]

        # admin: any class | HOD: only her department's classes
        if not _can_edit_timetable(user, assignment):
            raise PermissionDenied(
                "You can only edit the timetable for your own department's classes."
            )

        # if the class is submitted for approval, it's locked (non-admin)
        year_id, semester = _class_key(assignment)
        approval = _get_approval(year_id, semester)
        if approval and approval.status == TimetableApproval.Status.SUBMITTED and not is_admin(user):
            raise PermissionDenied(
                "This timetable is submitted for approval and locked. "
                "Wait for the admin to review it."
            )

        same_slot = TimetableEntry.objects.filter(day_of_week=day, time_slot=slot)

        # 1) CLASS clash
        class_clash = same_slot.filter(
            assignment__year=assignment.year,
            assignment__subject__semester=assignment.subject.semester,
        ).exists()
        if class_clash:
            raise ValidationError("This class already has a subject in that period.")

        # 2) TEACHER clash
        teacher_clash = same_slot.filter(
            assignment__teacher=assignment.teacher
        ).exists()
        if teacher_clash:
            raise ValidationError(
                f"{assignment.teacher.get_full_name() or assignment.teacher.username} "
                f"is already booked in that period."
            )

        serializer.save()

        # make sure a draft approval row exists; editing an APPROVED class
        # by a non-admin sends it back to draft (needs re-approval)
        approval = _ensure_approval(assignment)
        if approval.status == TimetableApproval.Status.APPROVED and not is_admin(user):
            _reset_to_draft(approval)


class TimetableDetail(generics.RetrieveDestroyAPIView):
    queryset = TimetableEntry.objects.all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        user = self.request.user
        assignment = instance.assignment

        if not _can_edit_timetable(user, assignment):
            raise PermissionDenied(
                "You can only edit the timetable for your own department's classes."
            )

        year_id, semester = _class_key(assignment)
        approval = _get_approval(year_id, semester)
        if approval and approval.status == TimetableApproval.Status.SUBMITTED and not is_admin(user):
            raise PermissionDenied(
                "This timetable is submitted for approval and locked. "
                "Wait for the admin to review it."
            )

        instance.delete()

        if approval and approval.status == TimetableApproval.Status.APPROVED and not is_admin(user):
            _reset_to_draft(approval)


# =====================================================
#  ASSIGNMENT OPTIONS  — subjects/teachers placeable for a class.
#  Admin: any class. HOD: only her department's classes.
# =====================================================
class AssignmentOptions(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (is_admin(user) or is_hod(user)):
            raise PermissionDenied("Only an admin or HOD can build the timetable.")

        year_id = request.query_params.get("year")
        semester = request.query_params.get("semester")

        qs = TeachingAssignment.objects.select_related(
            "subject", "teacher", "year", "course"
        )
        if year_id:
            qs = qs.filter(year_id=year_id)
        if semester:
            qs = qs.filter(subject__semester=semester)

        if not is_admin(user) and is_hod(user):
            qs = qs.filter(course_id__in=_hod_course_ids(user))

        data = [
            {
                "id": a.id,
                "subject": a.subject.name,
                "teacher_name": (a.teacher.get_full_name() or "").strip() or a.teacher.username,
            }
            for a in qs
        ]
        return Response(data)


# =====================================================
#  APPROVAL WORKFLOW
# =====================================================
class TimetableSubmit(APIView):
    """HOD (or admin) submits a class timetable (year + semester) for approval."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        year_id = request.data.get("year")
        semester = request.data.get("semester")

        if not year_id or not semester:
            return Response({"detail": "year and semester are required."}, status=400)

        from courses.models import Year
        try:
            year = Year.objects.get(id=year_id)
        except Year.DoesNotExist:
            return Response({"detail": "Year not found."}, status=404)

        course_id = getattr(year, "course_id", None)

        # HOD can only submit her own department's class
        if not is_admin(user):
            if course_id not in _hod_course_ids(user):
                return Response({"detail": "This class is not in your department."}, status=403)

        # must have at least one entry placed
        has_entries = TimetableEntry.objects.filter(
            assignment__year_id=year_id,
            assignment__subject__semester=semester,
        ).exists()
        if not has_entries:
            return Response(
                {"detail": "Add at least one class to the timetable before submitting."},
                status=400,
            )

        obj, _ = TimetableApproval.objects.get_or_create(
            year_id=year_id,
            semester=semester,
            defaults={"course_id": course_id, "status": TimetableApproval.Status.DRAFT},
        )
        obj.status = TimetableApproval.Status.SUBMITTED
        obj.submitted_by = user
        obj.submitted_at = timezone.now()
        obj.reviewed_by = None
        obj.reviewed_at = None
        obj.remark = ""
        obj.save()

        return Response({"status": obj.status, "message": "Submitted for approval."})


class TimetableApprovalStatus(APIView):
    """Current approval status for one class (used by the HOD builder badge)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year_id = request.query_params.get("year")
        semester = request.query_params.get("semester")
        if not year_id or not semester:
            return Response({"status": None})

        obj = _get_approval(year_id, semester)
        if not obj:
            return Response({"status": "draft", "remark": ""})

        return Response({
            "status": obj.status,
            "remark": obj.remark or "",
            "submitted_at": obj.submitted_at,
            "reviewed_at": obj.reviewed_at,
        })


class TimetableApprovalList(APIView):
    """Admin: list of class timetables and their approval status."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only an admin can review timetable approvals.")

        qs = TimetableApproval.objects.select_related(
            "course", "year", "submitted_by"
        )
        only = request.query_params.get("status")
        if only:
            qs = qs.filter(status=only)

        data = []
        for a in qs:
            data.append({
                "id": a.id,
                "course": a.course.name if a.course else "",
                "year_number": a.year.year_number if a.year else None,
                "semester": a.semester,
                "status": a.status,
                "submitted_by": a.submitted_by.username if a.submitted_by else None,
                "submitted_at": a.submitted_at,
                "remark": a.remark or "",
            })
        return Response(data)


class TimetableApprovalAction(APIView):
    """Admin approves or rejects (with remark) a submitted class timetable."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not is_admin(request.user):
            raise PermissionDenied("Only an admin can approve timetables.")

        try:
            a = TimetableApproval.objects.get(pk=pk)
        except TimetableApproval.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        action = request.data.get("action")
        remark = request.data.get("remark", "")

        a.reviewed_by = request.user
        a.reviewed_at = timezone.now()

        if action == "approve":
            a.status = TimetableApproval.Status.APPROVED
            a.remark = ""
        elif action == "reject":
            a.status = TimetableApproval.Status.REJECTED
            a.remark = remark
        else:
            return Response({"detail": "action must be approve or reject."}, status=400)

        a.save()
        return Response({"status": a.status, "message": f"Timetable {a.status}."})


# =====================================================
#  SEMESTER + HOLIDAYS  — admin only (college-wide)
# =====================================================
from .models import Semester, Holiday
from .serializers import SemesterSerializer, HolidaySerializer


class SemesterActive(generics.ListCreateAPIView):
    """
    GET  -> the active semester (as a 1-item list, or empty)
    POST -> save a semester; marks it active and deactivates the others
    """
    serializer_class = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Semester.objects.filter(is_active=True)

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can set the semester.")
        Semester.objects.update(is_active=False)
        serializer.save(is_active=True)


class HolidayListCreate(generics.ListCreateAPIView):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can add holidays.")
        serializer.save()


class HolidayDetail(generics.RetrieveDestroyAPIView):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can delete holidays.")
        instance.delete()