from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from courses.models import Enrollment, TeachingAssignment

from .models import TimeSlot, TimetableEntry
from .serializers import TimeSlotSerializer, TimetableEntrySerializer


# ---------- role helpers (your User has a `role` field) ----------
def is_admin(user):
    return getattr(user, "role", "") == "admin" or bool(getattr(user, "is_staff", False))


def is_teacher(user):
    return getattr(user, "role", "") == "teacher"


# =====================================================
#  TIME SLOTS  (bell schedule)
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
            raise PermissionDenied(
                "Only an admin can edit periods."
            )

        serializer.save()

    def perform_destroy(self, instance):

        if not is_admin(self.request.user):
            raise PermissionDenied(
                "Only an admin can edit periods."
            )

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

        # ---- TEACHER: their own classes across all departments ----
        if scope == "teacher" or (scope is None and is_teacher(user)):
            return qs.filter(assignment__teacher=user)

        # ---- ADMIN BUILDER: a specific class (Year id + semester) ----
        year_id = params.get("year")
        semester = params.get("semester")
        if year_id or semester:
            if year_id:
                qs = qs.filter(assignment__year_id=year_id)
            if semester:
                qs = qs.filter(assignment__subject__semester=semester)
            return qs

        # ---- STUDENT: from enrollment, fall back to course/year/semester ----
        enrolled_ids = Enrollment.objects.filter(
            student=user
        ).values_list("teaching_assignment_id", flat=True)

        if enrolled_ids:
            return qs.filter(assignment_id__in=list(enrolled_ids))

        # fallback — only if the student has no enrollments yet
        if user.course_id and user.year and user.semester:
            return qs.filter(
                assignment__course=user.course,
                assignment__year__year_number=user.year,
                assignment__subject__semester=user.semester,
            )

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not is_admin(user):
            raise PermissionDenied("Only an admin can edit the timetable.")

        assignment = serializer.validated_data["assignment"]
        day = serializer.validated_data["day_of_week"]
        slot = serializer.validated_data["time_slot"]

        same_slot = TimetableEntry.objects.filter(day_of_week=day, time_slot=slot)

        # 1) CLASS clash — same Year + same semester already has a subject here
        class_clash = same_slot.filter(
            assignment__year=assignment.year,
            assignment__subject__semester=assignment.subject.semester,
        ).exists()
        if class_clash:
            raise ValidationError("This class already has a subject in that period.")

        # 2) TEACHER clash — this teacher is already booked in that period
        teacher_clash = same_slot.filter(
            assignment__teacher=assignment.teacher
        ).exists()
        if teacher_clash:
            raise ValidationError(
                f"{assignment.teacher.get_full_name() or assignment.teacher.username} "
                f"is already booked in that period."
            )

        serializer.save()


class TimetableDetail(generics.RetrieveDestroyAPIView):
    queryset = TimetableEntry.objects.all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        if not is_admin(self.request.user):
            raise PermissionDenied("Only an admin can edit the timetable.")
        instance.delete()


# =====================================================
#  ASSIGNMENT OPTIONS  — subjects/teachers the admin can place
#  for a chosen class (Year id + semester). Used by the builder.
# =====================================================
class AssignmentOptions(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            raise PermissionDenied("Only an admin can build the timetable.")

        year_id = request.query_params.get("year")
        semester = request.query_params.get("semester")

        qs = TeachingAssignment.objects.select_related(
            "subject", "teacher", "year", "course"
        )
        if year_id:
            qs = qs.filter(year_id=year_id)
        if semester:
            qs = qs.filter(subject__semester=semester)

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
#  APPEND THIS to timetable/views.py
#  (is_admin already defined at the top of that file)
# =====================================================
from .models import Semester, Holiday                       # add to existing model imports
from .serializers import SemesterSerializer, HolidaySerializer   # add to existing serializer imports


# ---------- SEMESTER ----------
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
        # keep a single active semester
        Semester.objects.update(is_active=False)
        serializer.save(is_active=True)


# ---------- HOLIDAYS ----------
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