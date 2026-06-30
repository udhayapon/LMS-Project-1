# ===================== IMPORTS =====================
import csv
import io
import secrets

from django.contrib.auth import authenticate
from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone

from rest_framework import (viewsets, status)
from rest_framework.decorators import (api_view, permission_classes)
from rest_framework.response import Response
from rest_framework.permissions import (IsAuthenticated, AllowAny)
from rest_framework_simplejwt.tokens import (RefreshToken)

from .models import (User, Department)
from .serializers import (UserSerializer, DepartmentSerializer)


# ===================== DEPARTMENT VIEWSET =====================
class DepartmentViewSet(viewsets.ModelViewSet):

    queryset = Department.objects.all()

    serializer_class = DepartmentSerializer

    permission_classes = [IsAuthenticated]


# ===================== USER VIEWSET =====================
class UserViewSet(viewsets.ModelViewSet):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        role = self.request.query_params.get(
            "role"
        )

        # ================= TEACHERS =================
        if role == "teacher":

            return User.objects.filter(
                role="teacher"
            ).order_by(
                "employee_id"
            )

        # ================= OTHER ROLES =================
        if role:

            return User.objects.filter(
                role=role
            )

        # ================= ALL USERS =================
        return User.objects.all()

    # ================= CREATE =================
    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # ================= UPDATE =================
    def update(
        self,
        request,
        *args,
        **kwargs
    ):

        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # ================= DELETE =================
    def destroy(
        self,
        request,
        *args,
        **kwargs
    ):

        user = self.get_object()

        if user.role == "admin":

            return Response(

                {
                    "error":
                    "Admin user cannot be deleted"
                },

                status=status.HTTP_403_FORBIDDEN
            )

        user.delete()

        return Response(

            {
                "message":
                "User deleted successfully"
            },

            status=status.HTTP_200_OK
        )


# ===================== LOGIN API =====================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):

    username = request.data.get(
        "username"
    )

    password = request.data.get(
        "password"
    )

    if not username or not password:

        return Response(

            {
                "error":
                "Username and password required"
            },

            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(
        username=username,
        password=password
    )

    if user:

        refresh = RefreshToken.for_user(
            user
        )

        role = (
            "admin"
            if user.is_superuser
            else user.role
        )

        return Response({

            "access":
                str(refresh.access_token),

            "refresh":
                str(refresh),

            "id":
                user.id,

            "username":
                user.username,

            "email":
                user.email,

            "role":
                role,

            # DEPARTMENT
            "department":
                user.department.id
                if user.department
                else None,

            "department_name":
                user.department.name
                if user.department
                else None,

            "roll_number":
                user.roll_number,

            "employee_id":
                user.employee_id,

            "is_superuser":
                user.is_superuser
        })

    return Response(

        {
            "error":
            "Invalid credentials"
        },

        status=status.HTTP_400_BAD_REQUEST
    )


# ===================== ADMIN DASHBOARD =====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):

    try:

        if (not request.user.is_superuser and request.user.role != "admin"):

            return Response(

                {
                    "error":
                    "Access denied"
                },

                status=status.HTTP_403_FORBIDDEN
            )

        from courses.models import ( Course, Enrollment )

        return Response({

            "total_users": User.objects.count(),
            "total_students": User.objects.filter(role="student").count(),
            "total_teachers": User.objects.filter(role="teacher" ).count(),
            "total_courses":Course.objects.count(),
            "total_enrollments": Enrollment.objects.count()
        })

    except Exception as e:

        print("ADMIN DASHBOARD ERROR:",str(e))

        return Response( {"error": str(e)}, status=500 )

# ===================== STUDENT CSV: PASSWORD HELPER =====================
def _generate_password(length=8):
    """Random password — avoids confusing chars (0/O/1/l)."""
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ===================== STUDENT CSV: TEMPLATE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_template(request):
    """Admin downloads a blank CSV template for bulk student admission."""
    if request.user.role != "admin":
        return Response({"detail": "Only admin."}, status=403)

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="student-admission-template.csv"'
    writer = csv.writer(response)
    writer.writerow(["username", "email", "department", "course", "year", "semester", "batch_year"])
    writer.writerow(["john_doe", "john@example.com", "Computer Science", "B.E CSE", "1", "1", "2025"])
    return response


# ===================== STUDENT CSV: IMPORT =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def student_import(request):
    """
    Admin uploads the filled CSV to create many students at once.
    Looks up department/course by name; password auto-generated per student.
    Returns the generated credentials for the admin to distribute.
    """
    if request.user.role != "admin":
        return Response({"detail": "Only admin."}, status=403)

    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file is required."}, status=400)

    try:
        decoded = f.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return Response({"detail": "Could not read the file. Save it as CSV UTF-8."}, status=400)

    reader = csv.DictReader(io.StringIO(decoded))

    from courses.models import Course
    dept_map = {d.name.strip().lower(): d for d in Department.objects.all()}
    course_map = {c.name.strip().lower(): c for c in Course.objects.all()}

    created = []
    errors = []
    for i, row in enumerate(reader, start=2):
        username = (row.get("username") or "").strip()
        email = (row.get("email") or "").strip()
        dept_name = (row.get("department") or "").strip()
        course_name = (row.get("course") or "").strip()
        year = (row.get("year") or "").strip()
        semester = (row.get("semester") or "").strip()
        batch_year = (row.get("batch_year") or "").strip()

        if not username:
            continue

        if not email or not year or not semester:
            errors.append(f"Row {i} ({username}): missing required field(s)")
            continue

        if User.objects.filter(username=username).exists():
            errors.append(f"Row {i}: username '{username}' already exists")
            continue
        if User.objects.filter(email=email).exists():
            errors.append(f"Row {i}: email '{email}' already exists")
            continue

        dept = dept_map.get(dept_name.lower()) if dept_name else None
        if dept_name and not dept:
            errors.append(f"Row {i}: department '{dept_name}' not found")
            continue

        course = course_map.get(course_name.lower()) if course_name else None
        if course_name and not course:
            errors.append(f"Row {i}: course '{course_name}' not found")
            continue

        try:
            password = _generate_password()
            user = User(
                username=username,
                email=email,
                role="student",
                department=dept,
                course=course,
                year=int(year),
                semester=int(semester),
                batch_year=int(batch_year) if batch_year else None,
            )
            user.set_password(password)
            user.save()   # roll number auto-generated by the model
            created.append({
                "username": user.username,
                "roll_number": user.roll_number,
                "email": user.email,
                "password": password,
            })
        except Exception as e:
            errors.append(f"Row {i} ({username}): {str(e)}")

    msg = f"Created {len(created)} student(s)."
    if errors:
        msg += f" {len(errors)} skipped."

    return Response({
        "message": msg,
        "created": created,
        "errors": errors,
    })


# ===================== CHANGE PASSWORD =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Any logged-in user changes their own password."""
    old = request.data.get("old_password")
    new = request.data.get("new_password")

    if not old or not new:
        return Response({"detail": "old_password and new_password are required."}, status=400)

    if not request.user.check_password(old):
        return Response({"detail": "Current password is incorrect."}, status=400)

    if len(new) < 6:
        return Response({"detail": "New password must be at least 6 characters."}, status=400)

    request.user.set_password(new)
    request.user.save()
    return Response({"detail": "Password changed successfully."})

# ===================== PROMOTE STUDENTS (next semester) =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def promote_students(request):
    """
    Admin promotes a whole class (course + year + semester) up one semester.
    semester -> semester + 1; year advances every two semesters.
    Semester 8 students are skipped (final semester).
    Does NOT touch results, IA marks, or materials — those stay tagged by
    their original semester, preserving academic history.
    """
    if request.user.role != "admin":
        return Response({"detail": "Only admin."}, status=403)

    course = request.data.get("course")
    year = request.data.get("year")
    semester = request.data.get("semester")

    if not (course and year and semester):
        return Response({"detail": "course, year and semester are required."}, status=400)

    semester = int(semester)

    students = User.objects.filter(
        role="student",
        course_id=course,
        year=year,
        semester=semester,
    )

    if not students.exists():
        return Response({"detail": "No students found for this class.", "promoted": 0})

    # semester 8 = final; can't promote further
    if semester >= 8:
        return Response({
            "detail": "These students are in the final semester and cannot be promoted further.",
            "promoted": 0,
        })

    new_semester = semester + 1
    # year advances every 2 semesters: ceil(new_semester / 2)
    new_year = (new_semester + 1) // 2

    promoted = 0
    for s in students:
        s.semester = new_semester
        s.year = new_year
        s.save(update_fields=["semester", "year"])
        promoted += 1

    return Response({
        "detail": f"Promoted {promoted} student(s) to Year {new_year}, Semester {new_semester}.",
        "promoted": promoted,
        "new_year": new_year,
        "new_semester": new_semester,
    })

# ===================== HOD: MY DEPARTMENT =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_department(request):

    user = request.user

    departments = Department.objects.filter(hod=user)
    if not departments.exists():
        return Response({"is_hod": False, "departments": []})

    from courses.models import TeachingAssignment
    from attendance.models import Attendance
    from exams.models import SemesterResult

    PRESENT_STATUSES = ["present", "duty_leave"]

    result = []
    for dept in departments:
        teachers = User.objects.filter(role="teacher", department=dept).order_by("employee_id")
        students = User.objects.filter(role="student", department=dept).select_related("course").order_by("roll_number")
        student_ids = list(students.values_list("id", flat=True))

        # ----- teachers with their subjects -----
        teacher_list = []
        subject_ids = set()
        for t in teachers:
            assignments = (
                TeachingAssignment.objects
                .filter(teacher=t)
                .select_related("subject", "year", "course")
            )
            subjects = []
            for a in assignments:
                if a.subject:
                    subject_ids.add(a.subject.id)
                subjects.append({
                    "subject": a.subject.name if a.subject else "-",
                    "code": a.subject.code if a.subject and a.subject.code else "",
                    "semester": a.subject.semester if a.subject else None,
                    "year": a.year.year_number if a.year else None,
                    "course": a.course.name if a.course else "",
                })
            teacher_list.append({
                "id": t.id,
                "username": t.username,
                "email": t.email,
                "employee_id": t.employee_id,
                "subjects": subjects,
                "subject_count": len(subjects),
            })

        # ----- department attendance average -----
        att_records = Attendance.objects.filter(student_id__in=student_ids)
        att_total = att_records.count()
        att_present = att_records.filter(status__in=PRESENT_STATUSES).count()
        attendance_percent = round((att_present / att_total) * 100, 1) if att_total else None

        # ----- pass % and arrears (from published results) -----
        results = (
            SemesterResult.objects
            .filter(student_id__in=student_ids, is_published=True)
            .prefetch_related("entries")
        )
        passed = 0
        failed = 0
        for sr in results:
            entries = list(sr.entries.all())
            if not entries:
                continue
            if all(e.is_pass for e in entries):
                passed += 1
            else:
                failed += 1
        evaluated = passed + failed
        pass_percent = round((passed / evaluated) * 100, 1) if evaluated else None

        # ----- distinct courses in this department (for the timetable builder) -----
        dept_courses = {}
        for s in students:
            if s.course_id and s.course_id not in dept_courses:
                dept_courses[s.course_id] = s.course.name if s.course else f"Course {s.course_id}"
        courses_list = [{"id": cid, "name": name} for cid, name in dept_courses.items()]

        result.append({
            "id": dept.id,
            "name": dept.name,
            "total_teachers": teachers.count(),
            "total_students": students.count(),
            "total_subjects": len(subject_ids),
            "attendance_percent": attendance_percent,   # None if no records
            "pass_percent": pass_percent,                # None if no published results
            "arrears": failed,                           # students with at least one fail
            "courses": courses_list,                     # [{id, name}] for timetable builder
            "teachers": teacher_list,
            "students": [
                {
                    "id": s.id,
                    "username": s.username,
                    "email": s.email,
                    "roll_number": s.roll_number,
                    "course_id": s.course_id,
                    "course_name": s.course.name if s.course else None,
                    "year": s.year,
                    "semester": s.semester,
                }
                for s in students
            ],
        })

    return Response({"is_hod": True, "departments": result})


# ===================== HOD: DEPARTMENT RESULTS =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_results(request):
    """
    Results overview for the HOD's department, grouped by semester.
    For each semester: pass/fail counts + per-subject pass & fail breakdown.
    Also returns an 'all' bucket combining every semester.
    """
    user = request.user

    departments = Department.objects.filter(hod=user)
    if not departments.exists():
        return Response({"is_hod": False, "departments": []})

    from exams.models import SemesterResult

    def build_bucket(results_qs):
        """Compute pass/fail + subject stats for a set of SemesterResults."""
        passed_count = 0
        failed_count = 0
        subject_stats = {}

        for sr in results_qs:
            entries = list(sr.entries.all())
            if not entries:
                continue
            all_pass = all(e.is_pass for e in entries)
            if all_pass:
                passed_count += 1
            else:
                failed_count += 1
            for e in entries:
                name = e.subject.name if e.subject else "Unknown"
                if name not in subject_stats:
                    subject_stats[name] = {"pass": 0, "fail": 0}
                if e.is_pass:
                    subject_stats[name]["pass"] += 1
                else:
                    subject_stats[name]["fail"] += 1

        total_evaluated = passed_count + failed_count
        pass_pct = round((passed_count / total_evaluated) * 100, 1) if total_evaluated else 0

        subjects = []
        for name, s in subject_stats.items():
            total = s["pass"] + s["fail"]
            fail_rate = round((s["fail"] / total) * 100, 1) if total else 0
            pass_rate = round((s["pass"] / total) * 100, 1) if total else 0
            subjects.append({
                "subject": name,
                "passed": s["pass"],
                "failed": s["fail"],
                "total": total,
                "fail_rate": fail_rate,
                "pass_rate": pass_rate,
            })
        subjects.sort(key=lambda x: x["fail_rate"], reverse=True)

        return {
            "evaluated": total_evaluated,
            "passed": passed_count,
            "failed": failed_count,
            "pass_percent": pass_pct,
            "subjects": subjects,
        }

    result = []
    for dept in departments:
        students = User.objects.filter(role="student", department=dept)
        student_ids = list(students.values_list("id", flat=True))

        all_results = list(
            SemesterResult.objects
            .filter(student_id__in=student_ids, is_published=True)
            .prefetch_related("entries__subject")
        )

        # which semesters actually have data
        semesters_present = sorted({sr.semester for sr in all_results})

        # build one bucket per semester + an "all" bucket
        by_semester = {}
        for sem in semesters_present:
            sem_results = [sr for sr in all_results if sr.semester == sem]
            by_semester[str(sem)] = build_bucket(sem_results)

        all_bucket = build_bucket(all_results)

        result.append({
            "id": dept.id,
            "name": dept.name,
            "total_students": students.count(),
            "semesters": semesters_present,   # e.g. [1, 3]
            "all": all_bucket,                # combined
            "by_semester": by_semester,       # {"1": {...}, "3": {...}}
        })

    return Response({"is_hod": True, "departments": result})


# ===================== HOD: DEPARTMENT ATTENDANCE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_attendance(request):
    """
    Attendance overview for the HOD's department.
    At-risk list: students whose overall attendance % is below 80%
    (red < 75, amber 75-80), sorted lowest first.
    Daily per-class absence is the tutor's concern, not the HOD's.
    """
    user = request.user

    departments = Department.objects.filter(hod=user)
    if not departments.exists():
        return Response({"is_hod": False, "departments": []})

    from attendance.models import Attendance

    PRESENT_STATUSES = ["present", "duty_leave"]
    THRESHOLD = 75
    WARN_BAND = 80

    result = []
    for dept in departments:
        students = list(
            User.objects.filter(role="student", department=dept)
            .order_by("roll_number")
        )

        at_risk = []
        for s in students:
            records = Attendance.objects.filter(student=s)
            total = records.count()
            if total == 0:
                continue
            counted = records.filter(status__in=PRESENT_STATUSES).count()
            pct = round((counted / total) * 100, 1)

            if pct < WARN_BAND:
                at_risk.append({
                    "id": s.id,
                    "username": s.username,
                    "roll_number": s.roll_number,
                    "year": s.year,
                    "semester": s.semester,
                    "percent": pct,
                    "level": "danger" if pct < THRESHOLD else "warn",
                })

        at_risk.sort(key=lambda x: x["percent"])

        result.append({
            "id": dept.id,
            "name": dept.name,
            "total_students": len(students),
            "below_75": sum(1 for r in at_risk if r["level"] == "danger"),
            "near_75": sum(1 for r in at_risk if r["level"] == "warn"),
            "at_risk": at_risk,
        })

    return Response({"is_hod": True, "departments": result})


# ===================== HOD TUTOR: HELPER =====================
def _hod_course_ids(user):
    """Course IDs of the HOD's department(s), from the students. None if not a HOD."""
    dept_ids = list(
        Department.objects.filter(hod=user).values_list("id", flat=True)
    )
    if not dept_ids:
        return None

    return list(
        User.objects.filter(role="student", department_id__in=dept_ids)
        .exclude(course__isnull=True)
        .values_list("course_id", flat=True)
        .distinct()
    )


# ===================== HOD TUTOR: OVERVIEW =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_tutor_overview(request):
    """The HOD's department courses + how many years still need a tutor."""
    from courses.models import Course, YearTutor

    course_ids = _hod_course_ids(request.user)
    if course_ids is None:
        return Response({"is_hod": False, "courses": []})

    courses = Course.objects.filter(id__in=course_ids).order_by("name")

    result = []
    for c in courses:
        total = c.years.count()
        done = YearTutor.objects.filter(course=c).count()
        result.append({
            "id": c.id,
            "name": c.name,
            "total_years": total,
            "assigned": done,
            "pending": total - done,
        })

    return Response({"is_hod": True, "courses": result})


# ===================== HOD TUTOR: GRID FOR ONE COURSE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_tutor_grid(request, course_id):
    """For one course: each year + its current tutor + pickable teachers."""
    from courses.models import Course, YearTutor, TeachingAssignment

    course_ids = _hod_course_ids(request.user)
    if course_ids is None:
        return Response({"detail": "You are not a Head of Department."}, status=403)
    if course_id not in course_ids:
        return Response({"detail": "This course is not in your department."}, status=403)

    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return Response({"detail": "Course not found."}, status=404)

    tutors = {
        t.year_id: t
        for t in YearTutor.objects.filter(course=course).select_related("teacher")
    }

    years = []
    for y in course.years.all().order_by("year_number"):
        t = tutors.get(y.id)
        years.append({
            "year_id": y.id,
            "year_number": y.year_number,
            "tutor": {
                "id": t.id,
                "teacher_id": t.teacher.id,
                "teacher_name": t.teacher.username,
                "employee_id": t.teacher.employee_id,
            } if t else None,
        })

    dept_ids = list(
        Department.objects.filter(hod=request.user).values_list("id", flat=True)
    )
    teachers = (
        User.objects.filter(role="teacher", department_id__in=dept_ids)
        .exclude(id=request.user.id)   # don't list the HOD as a tutor option
        .order_by("employee_id")
    )

    return Response({
        "course": {"id": course.id, "name": course.name},
        "years": years,
        "teachers": [
            {"id": t.id, "username": t.username, "employee_id": t.employee_id}
            for t in teachers
        ],
    })


# ===================== HOD TUTOR: ASSIGN =====================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def hod_assign_tutor(request):
    """Assign a teacher as tutor for one year."""
    from courses.models import Course, Year, YearTutor

    course_ids = _hod_course_ids(request.user)
    if course_ids is None:
        return Response({"detail": "You are not a Head of Department."}, status=403)

    course_id = request.data.get("course")
    year_id = request.data.get("year")
    teacher_id = request.data.get("teacher")

    if not course_id or not year_id or not teacher_id:
        return Response({"detail": "course, year and teacher are required."}, status=400)

    if int(course_id) not in course_ids:
        return Response({"detail": "This course is not in your department."}, status=403)

    if YearTutor.objects.filter(year_id=year_id).exists():
        return Response({"detail": "This year already has a tutor. Remove the existing one first."}, status=400)

    try:
        course = Course.objects.get(id=course_id)
        year = Year.objects.get(id=year_id)
        teacher = User.objects.get(id=teacher_id, role="teacher")
    except (Course.DoesNotExist, Year.DoesNotExist, User.DoesNotExist):
        return Response({"detail": "Invalid course, year or teacher."}, status=400)

    tutor = YearTutor.objects.create(course=course, year=year, teacher=teacher)
    return Response({"id": tutor.id, "message": "Tutor assigned."}, status=201)


# ===================== HOD TUTOR: REMOVE =====================
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def hod_remove_tutor(request, tutor_id):
    """Remove a tutor assignment."""
    from courses.models import YearTutor

    course_ids = _hod_course_ids(request.user)
    if course_ids is None:
        return Response({"detail": "You are not a Head of Department."}, status=403)

    try:
        tutor = YearTutor.objects.get(id=tutor_id)
    except YearTutor.DoesNotExist:
        return Response({"detail": "Tutor assignment not found."}, status=404)

    if tutor.course_id not in course_ids:
        return Response({"detail": "This is not in your department."}, status=403)

    tutor.delete()
    return Response({"message": "Tutor removed."})


# ===================== TUTOR: MY CLASS =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_class(request):
    """
    For a teacher who is a tutor (YearTutor): their assigned class(es),
    with students + each student's attendance % and pass/fail status.
    """
    user = request.user

    from courses.models import YearTutor
    from attendance.models import Attendance
    from exams.models import SemesterResult

    tutor_links = (
        YearTutor.objects.filter(teacher=user)
        .select_related("course", "year")
    )
    if not tutor_links.exists():
        return Response({"is_tutor": False, "classes": []})

    PRESENT_STATUSES = ["present", "duty_leave"]

    def attendance_pct(student):
        records = Attendance.objects.filter(student=student)
        total = records.count()
        if total == 0:
            return None
        counted = records.filter(status__in=PRESENT_STATUSES).count()
        return round((counted / total) * 100, 1)

    def result_status(student):
        """passed / failed / None (no published result)."""
        results = (
            SemesterResult.objects
            .filter(student=student, is_published=True)
            .prefetch_related("entries")
        )
        any_result = False
        for sr in results:
            entries = list(sr.entries.all())
            if not entries:
                continue
            any_result = True
            if not all(e.is_pass for e in entries):
                return "failed"
        return "passed" if any_result else None

    classes = []
    for link in tutor_links:
        course = link.course
        year_number = link.year.year_number

        students = User.objects.filter(
            role="student",
            course=course,
            year=year_number,
        ).order_by("roll_number")

        student_list = []
        below_75 = 0
        failing = 0
        for s in students:
            att = attendance_pct(s)
            res = result_status(s)
            if att is not None and att < 75:
                below_75 += 1
            if res == "failed":
                failing += 1
            student_list.append({
                "id": s.id,
                "username": s.username,
                "roll_number": s.roll_number,
                "email": s.email,
                "semester": s.semester,
                "attendance_percent": att,      # None if no records
                "result_status": res,           # passed / failed / None
            })

        classes.append({
            "course_id": course.id,
            "course_name": course.name,
            "year_number": year_number,
            "total_students": students.count(),
            "below_75": below_75,
            "failing": failing,
            "students": student_list,
        })

    return Response({"is_tutor": True, "classes": classes})


def _tutor_student_ids(user):
    """Student ids in this tutor's assigned class(es). Matches my_class scoping."""
    from courses.models import YearTutor
    links = YearTutor.objects.filter(teacher=user).select_related("course", "year")
    if not links.exists():
        return User.objects.none().values_list("id", flat=True)
    q = Q()
    for link in links:
        q |= Q(course=link.course, year=link.year.year_number)
    return User.objects.filter(q, role="student").values_list("id", flat=True)


def _hod_student_ids(user):
    """Student ids in this HOD's department(s). Matches my_department scoping."""
    dept_ids = list(Department.objects.filter(hod=user).values_list("id", flat=True))
    return User.objects.filter(
        role="student", department_id__in=dept_ids
    ).values_list("id", flat=True)


def _mark_od_attendance(od):
    """HOD approval -> set existing attendance rows in range to duty_leave."""
    from attendance.models import Attendance
    Attendance.objects.filter(
        student=od.student,
        date__gte=od.from_date,
        date__lte=od.to_date,
    ).update(status="duty_leave", marked_by=od.hod_reviewed_by)


# ---------- Student ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def od_create(request):
    from attendance.serializers import ODRequestSerializer
    ser = ODRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    ser.save(student=request.user)
    return Response(ser.data, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def od_my_requests(request):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    qs = ODRequest.objects.filter(student=request.user)
    return Response(ODRequestSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def od_cancel(request, pk):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    try:
        od = ODRequest.objects.get(pk=pk, student=request.user)
    except ODRequest.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)
    if od.status != ODRequest.Status.PENDING:
        return Response({"detail": "Only pending requests can be cancelled."}, status=400)
    od.status = ODRequest.Status.CANCELLED
    od.stage = ODRequest.Stage.CLOSED
    od.save(update_fields=["status", "stage"])
    return Response(ODRequestSerializer(od).data)


# ---------- Tutor ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tutor_od_pending(request):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    qs = ODRequest.objects.filter(
        student_id__in=list(_tutor_student_ids(request.user)),
        stage=ODRequest.Stage.AWAITING_TUTOR,
        status=ODRequest.Status.PENDING,
    )
    return Response(ODRequestSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tutor_od_action(request, pk):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    action = request.data.get("action")
    remark = request.data.get("remark", "")
    try:
        od = ODRequest.objects.get(
            pk=pk,
            student_id__in=list(_tutor_student_ids(request.user)),
            stage=ODRequest.Stage.AWAITING_TUTOR,
        )
    except ODRequest.DoesNotExist:
        return Response({"detail": "Not found or not yours to review."}, status=404)
    od.tutor_reviewed_by = request.user
    od.tutor_remark = remark
    od.tutor_reviewed_at = timezone.now()
    if action == "approve":
        od.stage = ODRequest.Stage.AWAITING_HOD
    elif action == "reject":
        od.status = ODRequest.Status.REJECTED
        od.stage = ODRequest.Stage.CLOSED
    else:
        return Response({"detail": "action must be approve or reject."}, status=400)
    od.save()
    return Response(ODRequestSerializer(od).data)


# ---------- HOD ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_od_pending(request):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    qs = ODRequest.objects.filter(
        student_id__in=list(_hod_student_ids(request.user)),
        stage=ODRequest.Stage.AWAITING_HOD,
        status=ODRequest.Status.PENDING,
    )
    return Response(ODRequestSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def hod_od_action(request, pk):
    from attendance.models import ODRequest
    from attendance.serializers import ODRequestSerializer
    action = request.data.get("action")
    remark = request.data.get("remark", "")
    try:
        od = ODRequest.objects.get(
            pk=pk,
            student_id__in=list(_hod_student_ids(request.user)),
            stage=ODRequest.Stage.AWAITING_HOD,
        )
    except ODRequest.DoesNotExist:
        return Response({"detail": "Not found or not yours to review."}, status=404)
    od.hod_reviewed_by = request.user
    od.hod_remark = remark
    od.hod_reviewed_at = timezone.now()
    if action == "approve":
        od.status = ODRequest.Status.APPROVED
        od.stage = ODRequest.Stage.CLOSED
        _mark_od_attendance(od)
    elif action == "reject":
        od.status = ODRequest.Status.REJECTED
        od.stage = ODRequest.Stage.CLOSED
    else:
        return Response({"detail": "action must be approve or reject."}, status=400)
    od.save()
    return Response(ODRequestSerializer(od).data)


# ===================== HOD: CLASS PERFORMANCE =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hod_class_performance(request):
    """
    Per-year (class) performance for the HOD's department(s).

    For each year (1..4) inside the department:
      - student_count
      - pass_percent   (students whose every published result entry passed)
      - attendance_percent
      - arrears        (students with at least one fail)
      - tutor_name     (YearTutor for that year, across the dept's courses)
      - subjects[]     (per-subject pass_rate + fail count)

    Same calculation as my_department / hod_results, grouped by student.year
    instead of rolled up for the whole department.
    """
    user = request.user

    departments = Department.objects.filter(hod=user)
    if not departments.exists():
        return Response({"is_hod": False, "departments": []})

    from courses.models import YearTutor
    from attendance.models import Attendance
    from exams.models import SemesterResult

    PRESENT_STATUSES = ["present", "duty_leave"]

    result = []
    for dept in departments:
        students = list(
            User.objects.filter(role="student", department=dept)
            .select_related("course")
            .order_by("roll_number")
        )

        # course ids in this department (used to find the year's tutor)
        dept_course_ids = {s.course_id for s in students if s.course_id}

        # tutor name keyed by year_number (first match wins if multiple courses)
        tutor_by_year = {}
        for yt in (
            YearTutor.objects
            .filter(course_id__in=dept_course_ids)
            .select_related("teacher", "year")
        ):
            yn = yt.year.year_number if yt.year else None
            if yn is not None and yn not in tutor_by_year:
                tutor_by_year[yn] = yt.teacher.username if yt.teacher else None

        # group students by their year (integer)
        years = {}
        for s in students:
            years.setdefault(s.year, []).append(s)

        classes = []
        for year_number in sorted(y for y in years.keys() if y is not None):
            year_students = years[year_number]
            student_ids = [s.id for s in year_students]

            # ----- attendance % for the year -----
            att_records = Attendance.objects.filter(student_id__in=student_ids)
            att_total = att_records.count()
            att_present = att_records.filter(status__in=PRESENT_STATUSES).count()
            attendance_percent = (
                round((att_present / att_total) * 100, 1) if att_total else None
            )

            # ----- pass/fail + per-subject breakdown (published results) -----
            results = (
                SemesterResult.objects
                .filter(student_id__in=student_ids, is_published=True)
                .prefetch_related("entries__subject")
            )
            passed = 0
            failed = 0
            subject_stats = {}
            for sr in results:
                entries = list(sr.entries.all())
                if not entries:
                    continue
                if all(e.is_pass for e in entries):
                    passed += 1
                else:
                    failed += 1
                for e in entries:
                    name = e.subject.name if e.subject else "Unknown"
                    st = subject_stats.setdefault(name, {"pass": 0, "fail": 0})
                    if e.is_pass:
                        st["pass"] += 1
                    else:
                        st["fail"] += 1

            evaluated = passed + failed
            pass_percent = (
                round((passed / evaluated) * 100, 1) if evaluated else None
            )

            subjects = []
            for name, st in subject_stats.items():
                total = st["pass"] + st["fail"]
                pass_rate = round((st["pass"] / total) * 100, 1) if total else 0
                subjects.append({
                    "subject": name,
                    "pass_rate": pass_rate,
                    "failed": st["fail"],
                })
            subjects.sort(key=lambda x: x["pass_rate"])   # weakest subject first

            classes.append({
                "year": year_number,
                "student_count": len(year_students),
                "pass_percent": pass_percent,           # None if no published results
                "attendance_percent": attendance_percent,  # None if no records
                "avg_mark": None,                       # no numeric mark field on entries
                "arrears": failed,
                "tutor_name": tutor_by_year.get(year_number),
                "subjects": subjects,
            })

        result.append({
            "id": dept.id,
            "name": dept.name,
            "classes": classes,
        })

    return Response({"is_hod": True, "departments": result})


# ===================== TUTOR: STUDENT MARK REPORT =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tutor_student_report(request, student_id):
    """
    Full mark report for ONE student in the tutor's class — current semester
    only, published results only. Per subject: marks / max, grade, pass/fail.

    Reuses _tutor_student_ids() so a tutor can only open a student who is
    actually in their assigned class(es); anyone else returns 403.
    """
    from exams.models import SemesterResult

    # the student must belong to this tutor's class
    allowed_ids = set(_tutor_student_ids(request.user))
    if student_id not in allowed_ids:
        return Response(
            {"detail": "This student is not in your class."},
            status=403,
        )

    try:
        student = User.objects.get(id=student_id, role="student")
    except User.DoesNotExist:
        return Response({"detail": "Student not found."}, status=404)

    # the student's current semester only
    semester = student.semester

    sem_result = (
        SemesterResult.objects
        .filter(student=student, semester=semester, is_published=True)
        .prefetch_related("entries__subject")
        .first()
    )

    subjects = []
    passed = 0
    failed = 0
    if sem_result:
        for e in sem_result.entries.all():
            if e.is_pass:
                passed += 1
            else:
                failed += 1
            subjects.append({
                "subject": e.subject.name if e.subject else "Unknown",
                "code": (e.subject.code if e.subject and e.subject.code else ""),
                "marks_obtained": e.marks_obtained,   # may be None (absent / not entered)
                "max_marks": e.max_marks,
                "grade": e.grade,
                "is_pass": e.is_pass,
            })

    return Response({
        "student": {
            "id": student.id,
            "username": student.username,
            "roll_number": student.roll_number,
            "semester": semester,
        },
        "semester": semester,
        "published": bool(sem_result),   # False -> results not declared yet
        "passed": passed,
        "failed": failed,
        "subjects": subjects,
    })


# ===================== TUTOR: CLASS MARK SHEET (BY SEMESTER) =====================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_class_marksheet(request):
    """
    Printable class mark sheet for the tutor — grouped by semester so the
    teacher can pick which semester to print. Published results only.

    Per class: list of semesters that have data, and for each semester a
    full matrix (every class student x every subject) with marks/max,
    grade, pass/fail, and an overall result per student.
    """
    user = request.user

    from courses.models import YearTutor
    from exams.models import SemesterResult

    tutor_links = (
        YearTutor.objects.filter(teacher=user).select_related("course", "year")
    )
    if not tutor_links.exists():
        return Response({"is_tutor": False, "classes": []})

    classes = []
    for link in tutor_links:
        course = link.course
        year_number = link.year.year_number

        students = list(
            User.objects.filter(role="student", course=course, year=year_number)
            .order_by("roll_number")
        )
        student_ids = [s.id for s in students]

        # every published result for the class, any semester
        results = (
            SemesterResult.objects
            .filter(student_id__in=student_ids, is_published=True)
            .prefetch_related("entries__subject")
        )

        # group by semester: subjects seen + per-student marks
        by_sem = {}   # sem -> {"subjects": set, "per_student": {sid: {...}}}
        for sr in results:
            sem = sr.semester
            bucket = by_sem.setdefault(sem, {"subjects": set(), "per_student": {}})
            entries = list(sr.entries.all())
            marks = {}
            passed = 0
            failed = 0
            for e in entries:
                name = e.subject.name if e.subject else "Unknown"
                bucket["subjects"].add(name)
                if e.is_pass:
                    passed += 1
                else:
                    failed += 1
                marks[name] = {
                    "obtained": e.marks_obtained,   # None = absent
                    "max": e.max_marks,
                    "grade": e.grade,
                    "is_pass": e.is_pass,
                }
            bucket["per_student"][sr.student_id] = {
                "marks": marks,
                "passed": passed,
                "failed": failed,
                "has": bool(entries),
            }

        semesters = sorted(by_sem.keys())

        by_semester = {}
        for sem in semesters:
            bucket = by_sem[sem]
            subjects = sorted(bucket["subjects"])
            rows = []
            for s in students:
                ps = bucket["per_student"].get(s.id)
                if ps and ps["has"]:
                    result = "fail" if ps["failed"] > 0 else "pass"
                    rows.append({
                        "id": s.id,
                        "username": s.username,
                        "roll_number": s.roll_number,
                        "marks": ps["marks"],
                        "result": result,
                        "passed": ps["passed"],
                        "failed": ps["failed"],
                    })
                else:
                    # student has no published result for this semester
                    rows.append({
                        "id": s.id,
                        "username": s.username,
                        "roll_number": s.roll_number,
                        "marks": {},
                        "result": "pending",
                        "passed": 0,
                        "failed": 0,
                    })
            by_semester[str(sem)] = {"subjects": subjects, "students": rows}

        classes.append({
            "course_id": course.id,
            "course_name": course.name,
            "year_number": year_number,
            "semesters": semesters,         # e.g. [3, 4]
            "by_semester": by_semester,     # {"3": {...}, "4": {...}}
        })

    return Response({"is_tutor": True, "classes": classes})

# =====================================================
#  FACULTY PARTICIPATION (IQAC)
#  Paste these functions at the END of users/views.py.
#  Top-level functions, local imports — no change to existing imports.
#
#  Then register the routes in users/urls.py (shown after this file),
#  and add the names to the `from .views import (...)` list.
# =====================================================

# ---------- helper: who is the IQAC admin ----------
def _is_iqac(user):
    return getattr(user, "role", "") == "iqac_admin" or user.is_superuser


# ---------- TEACHER: add an activity (with proof upload) ----------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def participation_create(request):
    """A teacher logs one of their own activities. Proof file optional."""
    from .serializers import FacultyParticipationSerializer

    if request.user.role != "teacher":
        return Response({"detail": "Only teachers can add participation."}, status=403)

    ser = FacultyParticipationSerializer(data=request.data, context={"request": request})
    ser.is_valid(raise_exception=True)
    ser.save(faculty=request.user)   # always the logged-in teacher
    return Response(ser.data, status=201)


# ---------- TEACHER: list their own activities ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def participation_my(request):
    """The logged-in teacher's own activities."""
    from .models import FacultyParticipation
    from .serializers import FacultyParticipationSerializer

    qs = FacultyParticipation.objects.filter(faculty=request.user)
    ser = FacultyParticipationSerializer(qs, many=True, context={"request": request})
    return Response(ser.data)


# ---------- TEACHER: delete one of their own (mistake fix) ----------
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def participation_delete(request, pk):
    """A teacher removes one of their own activities."""
    from .models import FacultyParticipation

    try:
        item = FacultyParticipation.objects.get(pk=pk, faculty=request.user)
    except FacultyParticipation.DoesNotExist:
        return Response({"detail": "Not found."}, status=404)

    item.delete()
    return Response({"detail": "Deleted."})


# ---------- IQAC: view ALL activities (with optional filters) ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def iqac_participation_list(request):
    """
    IQAC admin sees every teacher's activities.
    Optional filters: ?teacher=<id>  ?category=<key>  ?year=<2025-26>  ?department=<id>
    """
    from .models import FacultyParticipation
    from .serializers import FacultyParticipationSerializer

    if not _is_iqac(request.user):
        return Response({"detail": "Only the IQAC admin can view this."}, status=403)

    qs = FacultyParticipation.objects.select_related("faculty", "faculty__department")

    teacher = request.query_params.get("teacher")
    category = request.query_params.get("category")
    year = request.query_params.get("year")
    department = request.query_params.get("department")

    if teacher:
        qs = qs.filter(faculty_id=teacher)
    if category:
        qs = qs.filter(category=category)
    if year:
        qs = qs.filter(academic_year=year)
    if department:
        qs = qs.filter(faculty__department_id=department)

    ser = FacultyParticipationSerializer(qs, many=True, context={"request": request})
    return Response(ser.data)


# ---------- IQAC: the counts / scoreboard ----------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def iqac_participation_summary(request):
    """
    Totals for the IQAC dashboard:
      - overall total activities
      - per-category counts
      - per-teacher counts (with department)
    Optional ?year=<2025-26> to scope to one academic year.
    """
    from .models import FacultyParticipation

    if not _is_iqac(request.user):
        return Response({"detail": "Only the IQAC admin can view this."}, status=403)

    qs = FacultyParticipation.objects.select_related("faculty", "faculty__department")

    year = request.query_params.get("year")
    if year:
        qs = qs.filter(academic_year=year)

    # build readable category labels from the model choices
    cat_labels = dict(FacultyParticipation.CATEGORY_CHOICES)

    # ----- per-category counts -----
    category_counts = {}
    # ----- per-teacher counts -----
    teacher_map = {}
    # ----- list of academic years present (for a dropdown) -----
    years = set()

    total = 0
    for p in qs:
        total += 1

        category_counts[p.category] = category_counts.get(p.category, 0) + 1

        if p.academic_year:
            years.add(p.academic_year)

        tid = p.faculty_id
        if tid not in teacher_map:
            teacher_map[tid] = {
                "id": tid,
                "name": p.faculty.username if p.faculty else "—",
                "employee_id": p.faculty.employee_id if p.faculty else "",
                "department": p.faculty.department.name if (p.faculty and p.faculty.department) else "—",
                "count": 0,
            }
        teacher_map[tid]["count"] += 1

    by_category = [
        {"category": key, "label": cat_labels.get(key, key), "count": cnt}
        for key, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    by_teacher = sorted(teacher_map.values(), key=lambda t: t["count"], reverse=True)

    return Response({
        "total": total,
        "by_category": by_category,
        "by_teacher": by_teacher,
        "years": sorted(years, reverse=True),
    })