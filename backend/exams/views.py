import csv
import io
import datetime
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.http import HttpResponse
from .services import compute_grade

from .models import( InternalAssessment, IAMark,ExamSchedule,RevaluationRequest, RevaluationWindow,SemesterResult, ResultEntry)

from .serializers import (
    InternalAssessmentSerializer,
    IAMarkStudentSerializer,
    SemesterResultSerializer,
    SemesterResultStudentSerializer,
    ExamScheduleSerializer,
    RevaluationRequestSerializer,
    RevaluationWindowSerializer

)

User = get_user_model()

# ===================== EXAM ADMIN HELPER =====================
# Roles allowed to manage exams: the full admin and the exam sub-admin.
EXAM_ADMIN_ROLES = ("admin", "exam_admin")


def is_exam_admin(user):
    """True if the user can manage exams (full admin or exam sub-admin)."""
    return getattr(user, "role", None) in EXAM_ADMIN_ROLES


# ===================== INTERNAL ASSESSMENT =====================
class InternalAssessmentViewSet(viewsets.ModelViewSet):

    serializer_class = InternalAssessmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = InternalAssessment.objects.select_related(
            "teaching_assignment__subject"
        ).prefetch_related("marks__student")

        # ---- role branches flow INTO shared filter, never return early ----
        if user.role == "teacher":
            qs = qs.filter(teaching_assignment__teacher=user)
        # admin / exam_admin see everything (no extra filter)

        # ?teaching_assignment= filter for both roles
        ta = self.request.query_params.get("teaching_assignment")
        if ta:
            qs = qs.filter(teaching_assignment_id=ta)
        return qs

    # ================= LOCK (ADMIN — DECLARE) =================
    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        if not is_exam_admin(request.user):
            raise PermissionDenied("Only admin or exam admin can lock IA marks.")
        ia = self.get_object()
        ia.is_locked = True
        ia.save(update_fields=["is_locked"])
        return Response({"status": "locked"})

    # ================= UNLOCK (ADMIN) =================
    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        if not is_exam_admin(request.user):
            raise PermissionDenied("Only admin or exam admin can unlock IA marks.")
        ia = self.get_object()
        ia.is_locked = False
        ia.save(update_fields=["is_locked"])
        return Response({"status": "unlocked"})


# ===================== IA MARK =====================
class IAMarkViewSet(viewsets.ModelViewSet):

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.user.role in ("student", "parent"):
            return IAMarkStudentSerializer
        from .serializers import IAMarkSerializer
        return IAMarkSerializer

    def get_queryset(self):
        user = self.request.user
        qs = IAMark.objects.select_related(
            "assessment__teaching_assignment__subject",
            "student",
        )

        if user.role == "student":
            # own marks, declared slots only
            return qs.filter(student=user, assessment__is_locked=True)

        if user.role == "parent":
            # children's marks, declared (locked) slots only
            from courses.views import get_parent_children
            child_ids = [c.id for c in get_parent_children(user)]
            qs = qs.filter(student_id__in=child_ids, assessment__is_locked=True)

            child = self.request.query_params.get("child")
            if child:
                qs = qs.filter(student_id=child)
            return qs

        if user.role == "teacher":
            qs = qs.filter(
                assessment__teaching_assignment__teacher=user
            )

        assessment = self.request.query_params.get("assessment")
        if assessment:
            qs = qs.filter(assessment_id=assessment)
        return qs

    # ================= BLOCK EDITS ON LOCKED SLOTS =================
    def perform_create(self, serializer):
        self._reject_if_locked(serializer.validated_data["assessment"])
        self._reject_if_student()
        serializer.save()

    def perform_update(self, serializer):
        self._reject_if_locked(serializer.instance.assessment)
        self._reject_if_student()
        serializer.save()

    def _reject_if_locked(self, assessment):
        if assessment.is_locked:
            raise ValidationError(
                "This IA is locked and can no longer be edited."
            )

    def _reject_if_student(self):
        if self.request.user.role in ("student", "parent"):
            raise PermissionDenied("Read-only role cannot edit marks.")

    # ================= BULK SAVE (TEACHER GRID) =================
    @action(detail=False, methods=["post"])
    def save_marks(self, request):
        """
        Teacher saves a whole IA grid in one call (mirrors attendance bulk_mark).
        Gets or creates the IA slot, then upserts each student's mark.
        Blocked once the slot is locked.
        """
        user = request.user
        ta_id = request.data.get("teaching_assignment")
        number = request.data.get("number")
        max_marks = request.data.get("max_marks", 50)
        records = request.data.get("records", [])

        if not ta_id or not number:
            raise ValidationError("teaching_assignment and number are required.")

        from courses.models import TeachingAssignment
        ta = get_object_or_404(TeachingAssignment, id=ta_id)

        if user.role == "teacher" and ta.teacher_id != user.id:
            raise PermissionDenied("Not your teaching assignment.")
        if user.role in ("student", "parent"):
            raise PermissionDenied("This role cannot enter marks.")

        slot, _ = InternalAssessment.objects.get_or_create(
            teaching_assignment=ta,
            number=number,
            defaults={"max_marks": max_marks},
        )

        if slot.is_locked:
            raise ValidationError("This IA is locked and can no longer be edited.")

        if slot.max_marks != max_marks:
            slot.max_marks = max_marks
            slot.save(update_fields=["max_marks"])

        for r in records:
            sid = r.get("student")
            if not sid:
                continue
            absent = bool(r.get("is_absent", False))
            obtained = None if absent else r.get("marks_obtained")
            IAMark.objects.update_or_create(
                assessment=slot,
                student_id=sid,
                defaults={"marks_obtained": obtained, "is_absent": absent},
            )

        return Response({"status": "saved", "assessment_id": slot.id})

# ===================== INTERNAL ASSESSMENT: CSV TEMPLATE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ia_template(request):
    """
    Teacher downloads a CSV pre-filled with the enrolled students + blank marks.
    Columns: student_id, roll_number, name, marks
    Query: teaching_assignment
    """
    if request.user.role not in ("teacher", "admin", "exam_admin"):
        return Response({"detail": "Teachers/admin only."}, status=403)

    ta_id = request.query_params.get("teaching_assignment")
    if not ta_id:
        return Response({"detail": "teaching_assignment is required."}, status=400)

    from courses.models import TeachingAssignment
    ta = get_object_or_404(TeachingAssignment, id=ta_id)

    if request.user.role == "teacher" and ta.teacher_id != request.user.id:
        return Response({"detail": "Not your teaching assignment."}, status=403)

    enrollments = Enrollment.objects.filter(
        teaching_assignment=ta
    ).select_related("student").order_by("student__roll_number")

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="ia-marks-template.csv"'
    writer = csv.writer(response)
    writer.writerow(["student_id", "roll_number", "name", "marks"])
    for en in enrollments:
        s = en.student
        writer.writerow([s.id, s.roll_number or "", s.username, ""])

    return response


# ===================== INTERNAL ASSESSMENT: CSV IMPORT =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ia_import(request):
    """
    Teacher uploads the filled CSV for one IA slot.
    Blank marks = absent. Blocked if the slot is locked.
    Expects: file, teaching_assignment, number, max_marks
    """
    if request.user.role not in ("teacher", "admin", "exam_admin"):
        return Response({"detail": "Teachers/admin only."}, status=403)

    f = request.FILES.get("file")
    ta_id = request.data.get("teaching_assignment")
    number = request.data.get("number")
    max_marks = request.data.get("max_marks", 50)

    if not f or not ta_id or not number:
        return Response({"detail": "file, teaching_assignment and number are required."}, status=400)

    try:
        max_marks = float(max_marks)
    except (TypeError, ValueError):
        max_marks = 50

    from courses.models import TeachingAssignment
    ta = get_object_or_404(TeachingAssignment, id=ta_id)

    if request.user.role == "teacher" and ta.teacher_id != request.user.id:
        return Response({"detail": "Not your teaching assignment."}, status=403)

    slot, _ = InternalAssessment.objects.get_or_create(
        teaching_assignment=ta,
        number=number,
        defaults={"max_marks": max_marks},
    )

    if slot.is_locked:
        return Response({"detail": "This IA is locked and can no longer be edited."}, status=400)

    if slot.max_marks != max_marks:
        slot.max_marks = max_marks
        slot.save(update_fields=["max_marks"])

    try:
        decoded = f.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({"detail": "Could not read the file. Save it as CSV UTF-8."}, status=400)

    reader = csv.DictReader(io.StringIO(decoded))

    saved = 0
    errors = []
    for i, row in enumerate(reader, start=2):
        sid = (row.get("student_id") or "").strip()
        raw = (row.get("marks") or "").strip()

        if not sid:
            continue

        # blank marks = absent
        if raw == "":
            IAMark.objects.update_or_create(
                assessment=slot,
                student_id=sid,
                defaults={"marks_obtained": None, "is_absent": True},
            )
            saved += 1
            continue

        try:
            obtained = float(raw)
        except ValueError:
            errors.append(f"Row {i}: '{raw}' is not a number")
            continue

        if obtained < 0 or obtained > max_marks:
            errors.append(f"Row {i}: {obtained} is out of range (0-{max_marks})")
            continue

        IAMark.objects.update_or_create(
            assessment=slot,
            student_id=sid,
            defaults={"marks_obtained": obtained, "is_absent": False},
        )
        saved += 1

    msg = f"Imported marks for {saved} student(s)."
    if errors:
        msg += f" {len(errors)} row(s) skipped: " + "; ".join(errors[:5])
        if len(errors) > 5:
            msg += f" ...and {len(errors) - 5} more."

    return Response({"message": msg, "saved": saved, "errors": errors})

# ===================== SEMESTER RESULT =====================
class SemesterResultViewSet(viewsets.ModelViewSet):

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.user.role in ("student", "parent"):
            return SemesterResultStudentSerializer
        return SemesterResultSerializer

    def get_queryset(self):
        user = self.request.user
        qs = SemesterResult.objects.select_related("student").prefetch_related(
            "entries__subject"
        )

        if user.role == "student":
            # own results, published only, all semesters
            return qs.filter(student=user, is_published=True)

        if user.role == "parent":
            # children's results, published only
            from courses.views import get_parent_children
            child_ids = [c.id for c in get_parent_children(user)]
            qs = qs.filter(student_id__in=child_ids, is_published=True)

            child = self.request.query_params.get("child")
            if child:
                qs = qs.filter(student_id=child)

            return qs

        # admin / exam_admin see everything; optional filters for the entry screen
        semester = self.request.query_params.get("semester")
        if semester:
            qs = qs.filter(semester=semester)

        student = self.request.query_params.get("student")
        if student:
            qs = qs.filter(student_id=student)

        return qs

    # ================= BULK SAVE (ADMIN ENTRY) =================
    @action(detail=False, methods=["post"])
    def save_results(self, request):
        """
        Admin saves final marks for one subject, for many students, in one call.
        For each student: get-or-create their SemesterResult for that semester,
        then upsert the ResultEntry for this subject (grade computed server-side).
        """
        user = request.user
        if not is_exam_admin(user):
            raise PermissionDenied("Only admin or exam admin can enter semester results.")

        subject_id = request.data.get("subject")
        semester = request.data.get("semester")
        max_marks = request.data.get("max_marks", 100)
        records = request.data.get("records", [])

        if not subject_id or not semester:
            raise ValidationError("subject and semester are required.")

        from courses.models import Subject
        subject = get_object_or_404(Subject, id=subject_id)

        for r in records:
            sid = r.get("student")
            if not sid:
                continue

            obtained = r.get("marks_obtained")
            obtained = None if obtained in ("", None) else float(obtained)

            grade, is_pass = compute_grade(obtained, max_marks)

            # one result header per student+semester
            result, _ = SemesterResult.objects.get_or_create(
                student_id=sid,
                semester=semester,
            )

            ResultEntry.objects.update_or_create(
                result=result,
                subject=subject,
                defaults={
                    "max_marks": max_marks,
                    "marks_obtained": obtained,
                    "grade": grade,
                    "is_pass": is_pass,
                },
            )

        return Response({"status": "saved"})

    # ================= PUBLISH (ADMIN — DECLARE) =================
    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        if not is_exam_admin(request.user):
            raise PermissionDenied("Only admin or exam admin can publish results.")
        result = self.get_object()
        result.is_published = True
        result.save(update_fields=["is_published"])
        return Response({"status": "published"})

    # ================= UNPUBLISH (ADMIN) =================
    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        if not is_exam_admin(request.user):
            raise PermissionDenied("Only admin or exam admin can unpublish results.")
        result = self.get_object()
        result.is_published = False
        result.save(update_fields=["is_published"])
        return Response({"status": "unpublished"})


# ===================== STUDENTS BY CLASS (SEMESTER RESULT ROSTER) =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def students_by_class(request):
    """
    Students in a given course + year + semester.
    Used by the semester-result entry grid — the roster is class-wide,
    not tied to a single teaching assignment.
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    course = request.query_params.get("course")
    year = request.query_params.get("year")
    semester = request.query_params.get("semester")

    if not (course and year and semester):
        return Response(
            {"detail": "course, year and semester are required."},
            status=400,
        )

    students = User.objects.filter(
        role="student",
        course_id=course,
        year=year,
        semester=semester,
    ).order_by("roll_number")

    data = [
        {
            "student": s.id,
            "student_name": s.username,
            "student_roll_no": s.roll_number,
        }
        for s in students
    ]
    return Response(data)

from attendance.models import Attendance
from courses.models import Enrollment, Fee

ATTENDANCE_FINE_TERM = "Attendance Shortage Fine"
ATTENDANCE_THRESHOLD = 75


def _attendance_percent(student):
    """ (present + duty_leave) / total  across all the student's records. """
    records = Attendance.objects.filter(student=student)
    total = records.count()
    if total == 0:
        return None  # no records yet
    counted = records.filter(status__in=["present", "duty_leave"]).count()
    return round((counted / total) * 100, 1)


def _is_eligible(student):
    """ Eligible if attendance >= 75% OR the attendance fine is paid. """
    pct = _attendance_percent(student)
    if pct is not None and pct >= ATTENDANCE_THRESHOLD:
        return True, pct, "attendance"
    # below threshold (or no records) — check fine
    fine_paid = Fee.objects.filter(
        student=student,
        term=ATTENDANCE_FINE_TERM,
        status="paid",
    ).exists()
    if fine_paid:
        return True, pct, "fine_paid"
    return False, pct, "blocked"

# ===================== SEMESTER RESULT: CSV TEMPLATE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def results_template(request):
    """
    Admin downloads a CSV pre-filled with the class roster + a blank marks column.
    Columns: student_id, roll_number, name, marks
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    course = request.query_params.get("course")
    year = request.query_params.get("year")
    semester = request.query_params.get("semester")
    if not (course and year and semester):
        return Response({"detail": "course, year and semester are required."}, status=400)

    students = User.objects.filter(
        role="student", course_id=course, year=year, semester=semester,
    ).order_by("roll_number")

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="marks-template.csv"'
    writer = csv.writer(response)
    writer.writerow(["student_id", "roll_number", "name", "marks"])
    for s in students:
        writer.writerow([s.id, s.roll_number or "", s.username, ""])

    return response


# ===================== SEMESTER RESULT: CSV IMPORT =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def results_import(request):
    """
    Admin uploads the filled CSV. Parses each row, validates, and saves marks
    for one subject across all students (grade computed server-side).
    Expects: file (CSV), subject, semester, max_marks
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    f = request.FILES.get("file")
    subject_id = request.data.get("subject")
    semester = request.data.get("semester")
    max_marks = request.data.get("max_marks", 100)

    if not f or not subject_id or not semester:
        return Response({"detail": "file, subject and semester are required."}, status=400)

    try:
        max_marks = float(max_marks)
    except (TypeError, ValueError):
        max_marks = 100

    from courses.models import Subject
    subject = get_object_or_404(Subject, id=subject_id)

    # read the uploaded CSV (utf-8-sig strips Excel's BOM)
    try:
        decoded = f.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({"detail": "Could not read the file. Save it as CSV UTF-8."}, status=400)

    reader = csv.DictReader(io.StringIO(decoded))

    saved = 0
    errors = []
    for i, row in enumerate(reader, start=2):  # row 1 is the header
        sid = (row.get("student_id") or "").strip()
        raw = (row.get("marks") or "").strip()

        if not sid:
            continue  # skip blank lines

        # blank marks = absent / not entered → skip
        if raw == "":
            continue

        try:
            obtained = float(raw)
        except ValueError:
            errors.append(f"Row {i}: '{raw}' is not a number")
            continue

        if obtained < 0 or obtained > max_marks:
            errors.append(f"Row {i}: {obtained} is out of range (0-{max_marks})")
            continue

        grade, is_pass = compute_grade(obtained, max_marks)

        result, _ = SemesterResult.objects.get_or_create(
            student_id=sid,
            semester=semester,
        )
        ResultEntry.objects.update_or_create(
            result=result,
            subject=subject,
            defaults={
                "max_marks": max_marks,
                "marks_obtained": obtained,
                "grade": grade,
                "is_pass": is_pass,
            },
        )
        saved += 1

    msg = f"Imported marks for {saved} student(s)."
    if errors:
        msg += f" {len(errors)} row(s) skipped: " + "; ".join(errors[:5])
        if len(errors) > 5:
            msg += f" ...and {len(errors) - 5} more."

    return Response({"message": msg, "saved": saved, "errors": errors})

# ===================== HALL TICKET: STUDENT ELIGIBILITY =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_hall_ticket(request):
    """
    Student's own hall-ticket status + the data needed to render it.
    """
    user = request.user
    if user.role != "student":
        return Response({"detail": "Students only."}, status=403)

    eligible, pct, reason = _is_eligible(user)

    # subjects = the student's enrolled subjects, with code + exam schedule
    from .models import ExamSchedule
    enrollments = Enrollment.objects.filter(student=user).select_related(
        "teaching_assignment__subject"
    )
    seen = {}
    for e in enrollments:
        subj = e.teaching_assignment.subject
        seen[subj.id] = subj  # dedupe by subject id

    subjects = []
    for subj in seen.values():
        sched = ExamSchedule.objects.filter(
            subject=subj, semester=user.semester
        ).first()
        subjects.append({
            "name": subj.name,
            "code": subj.code or "",
            "exam_date": sched.exam_date.isoformat() if sched else None,
            "session": sched.session if sched else None,
        })
    # sort by exam date (subjects without a date go last)
    subjects.sort(key=lambda s: (s["exam_date"] is None, s["exam_date"] or ""))

    # is there an unpaid attendance fine to show a Pay button for?
    fine = Fee.objects.filter(
        student=user,
        term=ATTENDANCE_FINE_TERM,
    ).exclude(status="paid").first()

    return Response({
        "student_name": user.username,
        "roll_number": user.roll_number,
        "attendance_percent": pct,
        "threshold": ATTENDANCE_THRESHOLD,
        "eligible": eligible,
        "reason": reason,                       # attendance | fine_paid | blocked
        "subjects": subjects,
        "fine_id": fine.id if fine else None,   # frontend pays this fee
        "fine_amount": float(fine.amount) if fine else None,
    })


# ===================== HALL TICKET: ADMIN ROSTER =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hall_ticket_roster(request):
    """
    Admin view: students in a course/year/semester with eligibility status.
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    course = request.query_params.get("course")
    year = request.query_params.get("year")
    semester = request.query_params.get("semester")
    if not (course and year and semester):
        return Response({"detail": "course, year and semester are required."}, status=400)

    students = User.objects.filter(
        role="student", course_id=course, year=year, semester=semester,
    ).order_by("roll_number")

    data = []
    for s in students:
        eligible, pct, reason = _is_eligible(s)
        has_fine = Fee.objects.filter(
            student=s, term=ATTENDANCE_FINE_TERM,
        ).exclude(status="paid").exists()
        data.append({
            "student": s.id,
            "student_name": s.username,
            "student_roll_no": s.roll_number,
            "attendance_percent": pct,
            "eligible": eligible,
            "reason": reason,
            "has_unpaid_fine": has_fine,
        })
    return Response(data)


# ===================== HALL TICKET: ADMIN GENERATE FINES =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_attendance_fines(request):
    """
    Admin creates an attendance-shortage fine for every below-75% student
    in a course/year/semester who doesn't already have one. One click, bulk.
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    course = request.data.get("course")
    year = request.data.get("year")
    semester = request.data.get("semester")
    amount = request.data.get("amount")
    due_date = request.data.get("due_date") or None

    if not (course and year and semester and amount):
        return Response({"detail": "course, year, semester and amount are required."}, status=400)

    students = User.objects.filter(
        role="student", course_id=course, year=year, semester=semester,
    )

    created = 0
    for s in students:
        eligible, pct, reason = _is_eligible(s)
        # only fine those genuinely short on attendance and not already fined/paid
        if pct is not None and pct < ATTENDANCE_THRESHOLD:
            already = Fee.objects.filter(student=s, term=ATTENDANCE_FINE_TERM).exists()
            if not already:
                Fee.objects.create(
                    student=s,
                    term=ATTENDANCE_FINE_TERM,
                    amount=amount,
                    due_date=due_date,
                    status="pending",
                )
                created += 1

    return Response({"message": f"{created} attendance fine(s) created.", "created": created})

# ===================== EXAM SCHEDULE =====================
class ExamScheduleViewSet(viewsets.ModelViewSet):
    """
    Admin enters exam date + session per subject per semester.
    Everyone authenticated can read (hall ticket needs it).
    """

    serializer_class = ExamScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ExamSchedule.objects.select_related("subject")

        semester = self.request.query_params.get("semester")
        if semester:
            qs = qs.filter(semester=semester)

        return qs

    def perform_create(self, serializer):
        if not is_exam_admin(self.request.user):
            raise PermissionDenied("Only admin or exam admin can set exam schedules.")
        serializer.save()

    def perform_update(self, serializer):
        if not is_exam_admin(self.request.user):
            raise PermissionDenied("Only admin or exam admin can edit exam schedules.")
        serializer.save()

    def perform_destroy(self, instance):
        if not is_exam_admin(self.request.user):
            raise PermissionDenied("Only admin or exam admin can delete exam schedules.")
        instance.delete()

# ===================== REVALUATION ====================
REVALUATION_FEE_TERM = "Revaluation Fee"


# ---------- ADMIN: open / close the window + set fee ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_revaluation_window(request):
    """
    Admin opens/closes the revaluation window for a semester and sets the fee.
    Body: { semester, is_open, fee_amount }
    """
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    semester = request.data.get("semester")
    is_open = request.data.get("is_open", False)
    fee_amount = request.data.get("fee_amount", 0)

    if not semester:
        return Response({"detail": "semester is required."}, status=400)

    window, _ = RevaluationWindow.objects.get_or_create(semester=semester)
    window.is_open = bool(is_open)
    window.fee_amount = fee_amount or 0
    if window.is_open:
        window.opened_at = timezone.now()
        window.closed_at = None
    else:
        window.closed_at = timezone.now()
    window.save()

    return Response(RevaluationWindowSerializer(window).data)


# ---------- WINDOW STATUS (admin + student) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def revaluation_window_status(request):
    """ Returns the window for ?semester=. Used by both admin and students. """
    semester = request.query_params.get("semester")
    if not semester:
        return Response({"detail": "semester is required."}, status=400)

    window = RevaluationWindow.objects.filter(semester=semester).first()
    if not window:
        return Response({
            "semester": int(semester),
            "is_open": False,
            "fee_amount": None,
        })

    return Response(RevaluationWindowSerializer(window).data)


# ---------- STUDENT: list own revaluation requests ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_revaluations(request):
    if request.user.role != "student":
        return Response({"detail": "Students only."}, status=403)

    qs = RevaluationRequest.objects.filter(
        student=request.user
    ).select_related("result_entry__subject", "result_entry__result", "fee")

    return Response(RevaluationRequestSerializer(qs, many=True).data)


# ---------- STUDENT: apply for revaluation ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def apply_revaluation(request):
     
    if request.user.role != "student":
        return Response({"detail": "Students only."}, status=403)

    entry_id = request.data.get("result_entry")
    if not entry_id:
        return Response({"detail": "result_entry is required."}, status=400)

    try:
        entry = ResultEntry.objects.select_related("result", "subject").get(id=entry_id)
    except ResultEntry.DoesNotExist:
        return Response({"detail": "Result not found."}, status=404)

    if entry.result.student_id != request.user.id:
        return Response({"detail": "Not your result."}, status=403)

    if not entry.result.is_published:
        return Response({"detail": "Result not published yet."}, status=400)

    if RevaluationRequest.objects.filter(student=request.user, result_entry=entry).exists():
        return Response({"detail": "You already applied for this subject."}, status=400)

    # window must be open for this semester
    window = RevaluationWindow.objects.filter(semester=entry.result.semester).first()
    if not window or not window.is_open:
        return Response(
            {"detail": "Revaluation portal is not open for this semester."},
            status=400
        )

    # create the fee using the window's amount
    fee = Fee.objects.create(
        student=request.user,
        term=REVALUATION_FEE_TERM,
        amount=window.fee_amount,
        due_date=datetime.date.today(),
        status="pending",
    )

    revreq = RevaluationRequest.objects.create(
        student=request.user,
        result_entry=entry,
        status="pending_payment",
        original_marks=entry.marks_obtained,
        fee=fee,
    )

    return Response(RevaluationRequestSerializer(revreq).data, status=201)


# ---------- STUDENT: confirm payment -> move to review ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_revaluation_payment(request, pk):
    try:
        revreq = RevaluationRequest.objects.select_related("fee").get(id=pk, student=request.user)
    except RevaluationRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)

    if revreq.fee and revreq.fee.status == "paid" and revreq.status == "pending_payment":
        revreq.status = "pending_review"
        revreq.save()

    return Response(RevaluationRequestSerializer(revreq).data)


# ---------- ADMIN: list requests to review ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def revaluation_review_list(request):
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    qs = RevaluationRequest.objects.exclude(
        status="pending_payment"
    ).select_related("result_entry__subject", "result_entry__result", "student", "fee")

    return Response(RevaluationRequestSerializer(qs, many=True).data)


# ---------- ADMIN: process a request ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def process_revaluation(request, pk):
    
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    try:
        revreq = RevaluationRequest.objects.select_related("result_entry").get(id=pk)
    except RevaluationRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)

    if revreq.status not in ["pending_review", "revised", "retained"]:
        return Response({"detail": "This request can't be processed yet."}, status=400)

    retain = request.data.get("retain", False)

    if retain:
        revreq.status = "retained"
        revreq.revised_marks = None
        revreq.save()
        return Response(RevaluationRequestSerializer(revreq).data)

    revised = request.data.get("revised_marks")
    if revised is None:
        return Response({"detail": "revised_marks required (or set retain=true)."}, status=400)

    # update the official result entry + recompute grade
    entry = revreq.result_entry
    entry.marks_obtained = revised
    grade, is_pass = compute_grade(float(revised), float(entry.max_marks))
    entry.grade = grade
    entry.is_pass = is_pass
    entry.save()

    revreq.revised_marks = revised
    revreq.status = "revised"
    revreq.save()

    return Response(RevaluationRequestSerializer(revreq).data)

# ---------- STUDENT: cancel an unpaid request ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_revaluation(request, pk):
    """
    Student cancels their own request — only allowed before payment.
    Deletes the request and its unpaid fee.
    """
    try:
        revreq = RevaluationRequest.objects.select_related("fee").get(
            id=pk, student=request.user
        )
    except RevaluationRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)

    if revreq.status != "pending_payment":
        return Response(
            {"detail": "Only unpaid requests can be cancelled."},
            status=400
        )

    # remove the unpaid fee too
    if revreq.fee and revreq.fee.status != "paid":
        revreq.fee.delete()

    revreq.delete()
    return Response({"status": "cancelled"})