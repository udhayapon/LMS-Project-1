import csv
import io
import datetime
import os, json, datetime, requests
from django.apps import apps
from courses.models import Subject
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
from events.holidays import holiday_dates

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


def _fine_term(semester):
    """
    One fine per student per semester. The term string is the key.

    Fee has no semester column, so the semester lives in the term text.
    Without this, a fine paid in Sem 3 would keep a student 'eligible'
    for every later semester regardless of their attendance.
    """
    return f"{ATTENDANCE_FINE_TERM} - Sem {semester}"


def _attendance_percent(student):

    records = Attendance.objects.filter(
        student=student,
        teaching_assignment__subject__semester=student.semester,
    )
    total = records.count()
    if total == 0:
        return None  # no records yet
    counted = records.filter(status__in=["present", "duty_leave"]).count()
    return round((counted / total) * 100, 1)


def _is_eligible(student):
    """
    Eligible if attendance >= 75% OR this semester's fine is paid.

    No attendance records at all -> blocked. Such a student IS fineable
    (see generate_attendance_fines), so they always have a way to unblock.
    Blocked must imply fineable, or the student is stuck forever.
    """
    pct = _attendance_percent(student)
    if pct is not None and pct >= ATTENDANCE_THRESHOLD:
        return True, pct, "attendance"

    # below threshold (or no records) — check this semester's fine
    fine_paid = Fee.objects.filter(
        student=student,
        term=_fine_term(student.semester),
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

    # is there an unpaid attendance fine for THIS semester to show a Pay button for?
    fine = Fee.objects.filter(
        student=user,
        term=_fine_term(user.semester),
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
            student=s, term=_fine_term(s.semester),
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
    Admin creates an attendance-shortage fine for every NOT-ELIGIBLE student
    in a course/year/semester who doesn't already have one for this semester.

    The rule is _is_eligible() — the SAME rule that blocks the hall ticket.
    If a student is blocked, they must be fineable, or they can never unblock.
    (This covers students with no attendance records at all: previously they
    were blocked but skipped by fine generation, leaving them stuck.)
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

    # Fee.due_date is NOT NULL, and the roster has no date picker.
    # Default to 14 days out when the admin doesn't supply one.
    if not due_date:
        due_date = datetime.date.today() + datetime.timedelta(days=14)

    students = User.objects.filter(
        role="student", course_id=course, year=year, semester=semester,
    )

    term = _fine_term(semester)

    created = 0
    skipped = 0
    for s in students:
        eligible, pct, reason = _is_eligible(s)
        if eligible:
            continue  # meets attendance, or already paid this semester's fine

        if Fee.objects.filter(student=s, term=term).exists():
            skipped += 1
            continue

        Fee.objects.create(
            student=s,
            term=term,
            amount=amount,
            due_date=due_date,
            status="pending",
        )
        created += 1

    return Response({
        "message": f"{created} attendance fine(s) created, {skipped} already existed.",
        "created": created,
        "skipped": skipped,
    })
# ===================== EXAM DRAFT HELPERS =====================
def _term_window():
    Semester = apps.get_model("timetable", "Semester")
    sem = Semester.objects.filter(is_active=True).order_by("-start_date").first()
    return (sem.start_date, sem.end_date) if sem else (None, None)

def _working_dates(start, end):
    
    """
    Working days in the term: no weekends (Sat OR Sun), no holidays.
    Every date the auto-arrange / AI-arrange can use comes from here, so the
    weekend rule only has to be correct in this one place.
    """
    holidays = holiday_dates()
    out, d = [], start
    while d and d <= end:
        is_weekend = d.weekday() >= 5          # 5 = Saturday, 6 = Sunday
        if not is_weekend and d not in holidays:
            out.append(d)
        d += datetime.timedelta(days=1)
    return out

def _class_subjects(course, year, semester):
    return list(Subject.objects.filter(
        year__course_id=course, year__year_number=year, semester=semester,
    ).order_by("name"))

def _auto_arrange(subjects, dates, gap=1, session="FN", per_day=1):
    rows = []
    if not dates:
        return rows
    # only two sessions exist (FN, AN) -> at most 2 non-clashing exams per day
    per_day = max(1, min(2, per_day))
    if per_day == 1:
        slot_sessions = [session]
    else:
        # 2 per day: pair one FN + one AN; "afternoon" pref just puts AN first
        slot_sessions = ["AN", "FN"] if session == "AN" else ["FN", "AN"]
    for i, s in enumerate(subjects):
        slot = i % per_day               # which session slot within the day
        day_no = (i // per_day) * gap    # advance the day every `per_day` subjects
        d = dates[min(day_no, len(dates) - 1)]
        rows.append({"subject": s.id, "exam_date": d.isoformat(), "session": slot_sessions[slot]})
    return rows

def _norm_date(s):
    """Coerce whatever Gemini returns into 'YYYY-MM-DD', or None if unusable."""
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y",
                "%B %d, %Y", "%B %d %Y", "%d %B %Y"):
        try:
            return datetime.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    # non-padded ISO like 2025-8-5
    import re as _re
    m = _re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, da = map(int, m.groups())
        try:
            return datetime.date(y, mo, da).isoformat()
        except ValueError:
            return None
    return None


def _ai_arrange(subjects, dates, preference, session="FN"):
    """Ask Gemini to arrange subjects across the given dates. Returns normalized rows.
    Raises on any failure so the caller can fall back to regex."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise ValueError("GEMINI_API_KEY is not set in the environment.")

    subj = "\n".join(f"- id={s.id} {s.code or ''} {s.name}" for s in subjects)
    days = ", ".join(d.isoformat() for d in dates)
    prompt = (
        "Schedule exams for one class.\n"
        "Subjects:\n" + subj +
        "\n\nAllowed dates (weekends/holidays already removed, use ONLY these): " + days +
        "\nSessions are FN or AN. Default session: " + session +
        "\nPreference from admin: " + (preference or "none") +
        '\n\nReturn ONLY a JSON array, no markdown, no explanation: '
        '[{"subject": <id>, "exam_date": "YYYY-MM-DD", "session": "FN"}]. '
        "Use only the ids and dates listed above. "
        "No two subjects on the same date+session."
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.0-flash:generateContent?key=" + key
    )
    r = requests.post(
        url,
        headers={"content-type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=30,
    )
    data = r.json()
    if "candidates" not in data:
        raise ValueError(f"Gemini error: {data}")

    text = data["candidates"][0]["content"]["parts"][0]["text"]

    # strip ```json fences if present, then pull out the array
    import re as _re
    text = _re.sub(r"```(?:json)?", "", text).strip()
    m = _re.search(r"\[.*\]", text, _re.S)
    if not m:
        raise ValueError(f"No JSON array in reply: {text[:300]}")

    parsed = json.loads(m.group(0))

    # normalize each row (fix date formats, clamp session)
    out = []
    for row in parsed:
        d = _norm_date(row.get("exam_date"))
        if not d:
            continue
        sess = row.get("session")
        out.append({
            "subject":   row.get("subject"),
            "exam_date": d,
            "session":   sess if sess in ("FN", "AN") else session,
        })
    return out


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

    # ================= DRAFT (reads the preference text reliably) =================
    @action(detail=False, methods=["post"], url_path="draft")
    def draft(self, request):
        if not is_exam_admin(request.user):
            raise PermissionDenied("Only admin or exam admin.")
        course     = request.data.get("course")
        year       = request.data.get("year")
        semester   = request.data.get("semester")
        preference = request.data.get("preference", "")
        mode       = (request.data.get("mode") or "auto").lower()   # NEW
        if not (course and year and semester):
            return Response({"detail": "course, year and semester are required."}, status=400)

        subjects = _class_subjects(course, year, semester)
        if not subjects:
            return Response({"detail": "No subjects for this class."}, status=400)
        start, end = _term_window()
        if not start:
            return Response({"detail": "Set the active semester first."}, status=400)
        dates = _working_dates(start, end)
        if not dates:
            return Response({"detail": "No working dates in the term."}, status=400)

        # ---------- read the preference text (narrows the date pool) ----------
        import re as _re
        pref = (preference or "").lower()

        # gap: from the stepper, overridden by "3 day gap" in the text
        try:
            gap = int(request.data.get("gap", 2))
        except (TypeError, ValueError):
            gap = 2
        gm = _re.search(r"(\d+)\s*days?\s*gap", pref)
        gap_explicit = bool(gm)          # did the user actually type "N day gap"?
        if gm:
            gap = int(gm.group(1))
        if gap < 1:
            gap = 1

        # session: from the dropdown, overridden by words
        session = request.data.get("session", "FN")
        if session not in ("FN", "AN"):
            session = "FN"
        if "afternoon" in pref or " an " in pref:
            session = "AN"
        elif "forenoon" in pref or "morning" in pref:
            session = "FN"

        # exams per day: "2 exams per day" / "each day have 2 exams" (only FN+AN -> max 2)
        pm = _re.search(r"(\d+)\s*exams?\s*(?:per|a|each)\s*day", pref)
        if not pm:
            pm = _re.search(r"(?:per|each|a)\s*day\s*(?:have|has|with|having)?\s*(\d+)\s*exam", pref)
        asked_per_day = int(pm.group(1)) if pm else 1
        per_day = max(1, min(2, asked_per_day))

        # start month: if a month is named, begin from its first working day
        months = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
                  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}
        start_from = None
        requested_start = None      # the exact day the admin asked for (before snapping)
        for name, num in months.items():
            if name in pref:
                # specific day? "august 8" or "8 august"
                dm = _re.search(name + r"\s+(\d{1,2})", pref) or _re.search(r"(\d{1,2})\s+" + name, pref)
                month_dates = [d for d in dates if d.month == num]
                if dm and month_dates:
                    day = int(dm.group(1))
                    try:
                        requested_start = datetime.date(month_dates[0].year, num, day)
                        start_from = next((d for d in dates if d >= requested_start), None)
                    except ValueError:
                        start_from = month_dates[0]
                else:
                    start_from = next((d for d in dates if d.month == num), None)
                break

        pool = dates
        if start_from:
            pool = [d for d in dates if d >= start_from]

        # "within N days" or "within N weeks" -> limit the window from the first date
        window_limit = None              # the date the user's window caps at
        wm = _re.search(r"within\s*(\d+)\s*day", pref)
        wwm = _re.search(r"within\s*(\d+)\s*week", pref)
        window_days = None
        if wm:
            window_days = int(wm.group(1))
        elif wwm:
            window_days = int(wwm.group(1)) * 7
        if window_days is not None and pool:
            window_limit = pool[0] + datetime.timedelta(days=window_days)
            pool = [d for d in pool if d <= window_limit]

        if not pool:
            pool = dates  # safety: never empty

        # ---- Option C: honor an explicitly typed gap; auto-fit otherwise ----
        notes = []
        if asked_per_day > 2:
            notes.append(f"Only 2 exams per day are possible (one FN + one AN) — capped from {asked_per_day}.")

        # how many distinct exam-days we need (2 subjects share a day when per_day=2)
        num_exam_days = (len(subjects) + per_day - 1) // per_day
        need = (num_exam_days - 1) * gap + 1     # working days this schedule spans

        if gap_explicit:
            # user typed "N day gap" -> keep it. If it needs more room than the
            # current window, extend the pool with more working days (up to the term end).
            if len(pool) < need:
                start0 = pool[0]
                extended = [d for d in dates if d >= start0][:need]
                if window_limit and extended and extended[-1] > window_limit:
                    notes.append(
                        f"{gap}-day gap needs {len(extended)} working days — "
                        f"the window was extended past your limit to fit all {len(subjects)} exams."
                    )
                pool = extended if extended else pool
        else:
            # no explicit gap -> safe to shrink so everything fits the window
            if len(pool) > 1 and num_exam_days > 1:
                max_gap = max(1, (len(pool) - 1) // (num_exam_days - 1))
                if gap > max_gap:
                    gap = max_gap

        gap_note = " ".join(notes) if notes else None

        # ---------- arrange: AI branch or regex branch ----------
        ai_note = None
        if mode == "ai":
            try:
                raw = _ai_arrange(subjects, pool, preference, session=session)
            except Exception as e:
                # AI failed — fall back to regex so we NEVER return an empty/June draft
                raw = _auto_arrange(subjects, pool, gap=gap, session=session, per_day=per_day)
                ai_note = f"AI unavailable, used auto-arrange. ({e})"
        else:
            raw = _auto_arrange(subjects, pool, gap=gap, session=session, per_day=per_day)

        # ---------- validate against the POOL (not all dates) — blocks June ----------
        valid_ids   = {s.id for s in subjects}
        valid_dates = {d.isoformat() for d in pool}
        rows = []
        for r in raw:
            if r.get("subject") in valid_ids and r.get("exam_date") in valid_dates:
                rows.append({
                    "subject":   r["subject"],
                    "exam_date": r["exam_date"],
                    "session":   r["session"] if r.get("session") in ("FN", "AN") else "FN",
                })

        # if AI dropped/duplicated subjects and left the draft incomplete, redo with regex
        if mode == "ai" and len(rows) < len(subjects):
            raw = _auto_arrange(subjects, pool, gap=gap, session=session, per_day=per_day)
            rows = [{
                "subject": r["subject"],
                "exam_date": r["exam_date"],
                "session": r["session"] if r.get("session") in ("FN", "AN") else "FN",
            } for r in raw if r["subject"] in valid_ids and r["exam_date"] in valid_dates]
            if ai_note is None:
                ai_note = "AI returned an incomplete schedule, used auto-arrange."

        actual_start = pool[0] if pool else None
        return Response({
            "draft": rows,
            "ai_note": ai_note,
            "gap_note": gap_note,
            "requested_start": requested_start.isoformat() if requested_start else None,
            "actual_start": actual_start.isoformat() if actual_start else None,
        })   # NOT saved — just a draft


# ===================== SCHEDULED CLASSES (overview) =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def scheduled_classes(request):
    """Every class that already has an exam schedule, with counts + date range."""
    if not is_exam_admin(request.user):
        return Response({"detail": "Only admin or exam admin."}, status=403)

    from django.db.models import Count, Min, Max
    rows = (
        ExamSchedule.objects
        .select_related("subject__year__course")
        .values(
            "semester",
            "subject__year__year_number",
            "subject__year__course_id",
            "subject__year__course__name",
        )
        .annotate(count=Count("id"), first=Min("exam_date"), last=Max("exam_date"))
        .order_by("subject__year__course__name", "subject__year__year_number", "semester")
    )
    data = [{
        "course_id":   r["subject__year__course_id"],
        "course_name": r["subject__year__course__name"],
        "year":        r["subject__year__year_number"],
        "semester":    r["semester"],
        "count":       r["count"],
        "first":       r["first"],
        "last":        r["last"],
    } for r in rows]
    return Response(data)


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