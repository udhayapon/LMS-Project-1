# ===================== STANDARD LIBRARY =====================
import os
import mimetypes
from datetime import datetime

# ===================== DJANGO =====================
from django.contrib.auth import get_user_model
from django.http import HttpResponse, FileResponse

# ===================== DJANGO REST FRAMEWORK =====================
from rest_framework import viewsets, status
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response

# ===================== OPENPYXL =====================
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ===================== LOCAL MODELS =====================
from .models import (
    Course,
    Enrollment,
    Assignment,
    Submission,
    Lecture,
    Note,
    LiveSession,
    Notification,
    Quiz,
    Question,
    QuizAttempt,
    Mark,
)

# ===================== LOCAL SERIALIZERS =====================
from .serializers import (
    CourseSerializer,
    EnrollmentSerializer,
    AssignmentSerializer,
    SubmissionSerializer,
    LectureSerializer,
    NoteSerializer,
    LiveSessionSerializer,
    NotificationSerializer,
    QuizSerializer,
    QuestionSerializer,
    QuizAttemptSerializer,
    MarkSerializer,
)

User = get_user_model()

# ===================== CUSTOM PERMISSION =====================
class IsAdminOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'


# ===================== COURSE VIEWSET =====================
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().order_by('-created_at')
    serializer_class = CourseSerializer
    permission_classes = []


# ===================== ENROLLMENT VIEWSET =====================
class EnrollmentViewSet(viewsets.ModelViewSet):
    queryset = Enrollment.objects.all().order_by('-enrolled_at')
    serializer_class = EnrollmentSerializer
    permission_classes = []


# ===================== ADMIN DASHBOARD API =====================
@api_view(['GET'])
@permission_classes([])
def admin_dashboard(request):
    total_users = User.objects.count()
    total_students = User.objects.filter(role='student').count()
    total_teachers = User.objects.filter(role='teacher').count()

    total_courses = Course.objects.count()
    total_enrollments = Enrollment.objects.count()

    data = {
        "total_users": total_users,
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_courses": total_courses,
        "total_enrollments": total_enrollments,
    }

    return Response(data)

# ===================== Teacher-dashboard =====================

@api_view(['GET'])
def teacher_dashboard(request):
    teacher_id = request.query_params.get('teacher_id')
    if not teacher_id:
        return Response({"error": "teacher_id required"}, status=400)

    from .models import Course, Enrollment
    my_courses = Course.objects.filter(teacher_id=teacher_id)
    course_ids = my_courses.values_list('id', flat=True)
    total_students = Enrollment.objects.filter(course_id__in=course_ids).values('student').distinct().count()
    total_enrollments = Enrollment.objects.filter(course_id__in=course_ids).count()
    total_assignments = Assignment.objects.filter(course__in=my_courses).count()

    return Response({
        "total_courses": my_courses.count(),
        "total_students": total_students,
        "total_enrollments": total_enrollments,
        "total_assignments": total_assignments,
        "courses": [
            {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "department": c.department,
                "student_count": Enrollment.objects.filter(course=c).count()
            }
            for c in my_courses
        ]
    })


@api_view(['GET'])
def teacher_students(request):
    teacher_id = request.query_params.get('teacher_id')
    if not teacher_id:
        return Response({"error": "teacher_id required"}, status=400)

    from .models import Course, Enrollment
    my_courses = Course.objects.filter(teacher_id=teacher_id)
    enrollments = Enrollment.objects.filter(course__in=my_courses).select_related('student', 'course')

    data = []
    seen = set()
    for e in enrollments:
        if e.student.id not in seen:
            seen.add(e.student.id)
            data.append({
                "id": e.student.id,
                "username": e.student.username,
                "roll_number": e.student.roll_number or "N/A",
                "department": e.student.department,
                "course_title": e.course.title,
            })

    return Response(data)

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # skip CSRF check
    
#====================assignment==================

class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all().order_by('-created_at')
    serializer_class = AssignmentSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]

#====================submission==================

class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class         = SubmissionSerializer
    authentication_classes   = [TokenAuthentication, SessionAuthentication]
    permission_classes       = [IsAuthenticated]                   
    parser_classes           = [MultiPartParser, FormParser, JSONParser]

    # ── queryset: role-based filtering ──
    def get_queryset(self):
        user = self.request.user
        qs   = Submission.objects.select_related(
            'assignment__course', 'student'
        ).all()

        if not user.is_authenticated:
            return qs

        # student sees only their own submissions
        if getattr(user, 'role', None) == 'student':
            student_id = self.request.query_params.get('student')
            if student_id:
                return qs.filter(student_id=student_id)
            return qs.filter(student=user)

        # teacher sees submissions for their courses
        if getattr(user, 'role', None) == 'teacher':
            course_id  = self.request.query_params.get('course')
            asgn_id    = self.request.query_params.get('assignment')
            status_f   = self.request.query_params.get('status')
            teacher_id = self.request.query_params.get('teacher_id')

            # Filter to only this teacher's courses by default
            if teacher_id:
                qs = qs.filter(assignment__course__teacher_id=teacher_id)
            else:
                qs = qs.filter(assignment__course__teacher=user)

            if course_id:
                qs = qs.filter(assignment__course_id=course_id)
            if asgn_id:
                qs = qs.filter(assignment_id=asgn_id)
            if status_f:
                qs = qs.filter(status=status_f)
            return qs

        # admin sees everything
        return qs

    # ── student submits ──
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # prevent duplicate submission
            asgn_id    = request.data.get('assignment')
            student_id = request.data.get('student')
            if Submission.objects.filter(
                assignment_id=asgn_id, student_id=student_id
            ).exists():
                return Response(
                    {"error": "You have already submitted this assignment."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── teacher grades: PATCH /api/learning/submissions/{id}/ ──
    def partial_update(self, request, *args, **kwargs):
        instance   = self.get_object()
        marks      = request.data.get('marks')
        feedback   = request.data.get('feedback', '')

        if marks is not None:
            instance.marks    = marks
            instance.feedback = feedback
            instance.status   = 'evaluated'
            instance.save()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        return super().partial_update(request, *args, **kwargs)

    # ── GET /api/learning/submissions/{id}/receipt/ ──
    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        sub = self.get_object()
        return Response({
            "submission_id":   sub.id,
            "assignment":      sub.assignment.title,
            "student":         sub.student.username,
            "submitted_at":    sub.submitted_at,
            "status":          sub.status,
            "receipt_message": (
                f"Your submission for '{sub.assignment.title}' was received "
                f"on {sub.submitted_at.strftime('%b %d, %Y at %I:%M %p')}."
            ),
        })


#====================lecture==================

class LectureViewSet(viewsets.ModelViewSet):
    queryset = Lecture.objects.all().order_by('-created_at')
    serializer_class = LectureSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]

#====================notes==================

class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


def serve_note_file(request, pk):
    note = Note.objects.get(pk=pk)
    file_path = note.file.path
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        mime_type = 'application/octet-stream'
    response = FileResponse(open(file_path, 'rb'), content_type=mime_type)
    response['Content-Disposition'] = f'inline; filename="{os.path.basename(file_path)}"'
    return response

#====================live class==================

class LiveSessionViewSet(viewsets.ModelViewSet):
    queryset = LiveSession.objects.all()
    serializer_class = LiveSessionSerializer
    authentication_classes = [TokenAuthentication, CsrfExemptSessionAuthentication]

    def perform_create(self, serializer):
        user = self.request.user
        send_reminder = str(self.request.data.get('send_reminder', 'false')).lower() == 'true'  

        print("=== DEBUG ===")
        print("send_reminder:", send_reminder)
        print("user:", user)

        instance = serializer.save(created_by=user if user.is_authenticated else None)

        print("course:", instance.course)

# ============================Send in-app notifications to enrolled students================================
        if send_reminder and instance.course:
            enrollments = Enrollment.objects.filter(course=instance.course)
            print("enrollments count:", enrollments.count())  # ← ADD
            notifications = [
                Notification(
                    user=enrollment.student,
                    message=f"📅 Reminder: Live class '{instance.title}' is scheduled on {instance.date} at {instance.time}. Join here: {instance.meeting_link}"
                )
                for enrollment in enrollments
            ]
            Notification.objects.bulk_create(notifications)
            print("Notifications created!")  # ← ADD
        else:
            print("Skipped - send_reminder:", send_reminder, "course:", instance.course)  

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')
    
#====================quiz==================

class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    authentication_classes = [TokenAuthentication, CsrfExemptSessionAuthentication]

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user if user.is_authenticated else None)

class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    authentication_classes = [TokenAuthentication, CsrfExemptSessionAuthentication]

class MarkViewSet(viewsets.ModelViewSet):
    serializer_class = MarkSerializer
    authentication_classes = [TokenAuthentication, CsrfExemptSessionAuthentication]

    def get_queryset(self):
        return Mark.objects.all()

class QuizAttemptViewSet(viewsets.ModelViewSet):
    serializer_class = QuizAttemptSerializer
    authentication_classes = [TokenAuthentication, CsrfExemptSessionAuthentication]

    def get_queryset(self):
        return QuizAttempt.objects.filter(student=self.request.user)

    def perform_create(self, serializer):
        quiz_id = self.request.data.get('quiz')
        answers = self.request.data.get('answers', {})
        quiz = Quiz.objects.get(id=quiz_id)

        # Auto-calculate score
        score = 0
        for question in quiz.questions.all():
            selected = answers.get(str(question.id))
            if selected == question.correct_answer:
                score += question.marks

        serializer.save(student=self.request.user, score=score)

# =========================================================================
# DOWNLOAD THE MARKSHEET =======================================
# ===========================================================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_marksheet(request):
    teacher_id = request.query_params.get('teacher_id')
    assignment_id = request.query_params.get('assignment_id')

    subs = Submission.objects.select_related(
        'student', 'assignment__course'
    ).filter(assignment__course__teacher_id=teacher_id)

    if assignment_id:
        subs = subs.filter(assignment_id=assignment_id)

    # ── Colors ──
    DARK_BLUE   = "1F3864"
    MED_BLUE    = "2E75B6"
    LIGHT_BLUE  = "D6E4F0"
    ACCENT_BLUE = "BDD7EE"
    WHITE       = "FFFFFF"
    LIGHT_GRAY  = "F2F2F2"
    DARK_GRAY   = "404040"
    GREEN_BG    = "E2EFDA"
    GREEN_TEXT  = "375623"
    RED_BG      = "FCE4D6"
    RED_TEXT    = "9C0006"

    def solid(hex_color):
        return PatternFill("solid", start_color=hex_color, fgColor=hex_color)

    def thin_border():
        s = Side(style="thin", color="BFBFBF")
        return Border(left=s, right=s, top=s, bottom=s)

    # Group by assignment
    from collections import defaultdict
    by_assignment = defaultdict(list)
    for sub in subs:
        key = (sub.assignment.title, sub.assignment.course.title if sub.assignment.course else "Course")
        by_assignment[key].append(sub)

    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # remove default sheet

    teacher_name = request.user.username
    today = datetime.today()
    date_str = today.strftime("%d-%m-%Y")

    for (assignment_title, course_title), sub_list in by_assignment.items():
        ws = wb.create_sheet(title=assignment_title[:31])

        # Column widths
        for col, w in zip("ABCDEFGHI", [14,20,10,14,18,14,16,16,14]):
            ws.column_dimensions[get_column_letter(ord(col)-64)].width = w

        # Row heights
        ws.row_dimensions[1].height = 8
        ws.row_dimensions[2].height = 36
        ws.row_dimensions[3].height = 8
        for r in [4,5]: ws.row_dimensions[r].height = 22
        ws.row_dimensions[6].height = 8
        ws.row_dimensions[7].height = 30

        # Title banner
        ws.merge_cells("A2:I2")
        c = ws["A2"]
        c.value = "ASSIGNMENT MARKS REGISTER"
        c.font = Font(name="Arial", size=18, bold=True, color=WHITE)
        c.fill = solid(DARK_BLUE)
        c.alignment = Alignment(horizontal="center", vertical="center")

        # Info rows
        max_marks = sub_list[0].assignment.max_marks if sub_list else 100
        pass_mark = round(max_marks * 0.4)
        due_date = sub_list[0].assignment.due_date.strftime("%d-%m-%Y") if sub_list and sub_list[0].assignment.due_date else date_str

        info = [
            ("A4","Teacher:", "B4", teacher_name, "D4","Subject:", "E4", course_title, "G4","Academic Year:", "H4", f"{today.year} – {today.year+1}"),
            ("A5","Assignment:", "B5", assignment_title, "D5","Max Mark:", "E5", f"{max_marks}  |  Pass Mark: {pass_mark}", "G5","Due Date:", "H5", due_date),
        ]
        for row_data in info:
            for lbl_cell, lbl_val, val_cell, val_val, lbl2, lbl2_val, val2, val2_val, lbl3, lbl3_val, val3, val3_val in [row_data]:
                for cell, val, is_label in [(lbl_cell,lbl_val,True),(val_cell,val_val,False),(lbl2,lbl2_val,True),(val2,val2_val,False),(lbl3,lbl3_val,True),(val3,val3_val,False)]:
                    c = ws[cell]
                    c.value = val
                    c.font = Font(name="Arial", size=10, bold=is_label, color=WHITE if is_label else DARK_GRAY)
                    c.fill = solid(MED_BLUE if is_label else LIGHT_BLUE)
                    c.alignment = Alignment(horizontal="left", vertical="center", indent=1)
                    c.border = thin_border()

        for merge in ["B4:C4","E4:F4","H4:I4","B5:C5","E5:F5","H5:I5"]:
            ws.merge_cells(merge)

        # Headers
        headers = ["Roll No","Student Name","Class","Submitted?","Submission Date","Total Marks","Marks Obtained","Percentage (%)","Status"]
        for i, h in enumerate(headers, 1):
            c = ws.cell(row=7, column=i)
            c.value = h
            c.font = Font(name="Arial", size=10, bold=True, color=WHITE)
            c.fill = solid(MED_BLUE)
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            c.border = thin_border()

        # Data rows
        pass_count = fail_count = 0
        highest = 0
        total_marks_sum = 0
        graded_count = 0

        for row_idx, sub in enumerate(sub_list, 8):
            ws.row_dimensions[row_idx].height = 22
            submitted = "Yes" if (sub.file or sub.text_entry or sub.url_entry) else "No"
            sub_date = sub.submitted_at.strftime("%d/%m/%Y") if sub.submitted_at else "---"
            marks = sub.marks
            max_m = sub.assignment.max_marks or 100
            pct = f"{(marks/max_m*100):.1f}%" if marks is not None else "---"
            threshold = max_m * 0.4
            status = "Fail" if submitted=="No" else ("---" if marks is None else ("Pass" if marks>=threshold else "Fail"))

            if marks is not None:
                if marks >= threshold: pass_count += 1
                else: fail_count += 1
                if marks > highest: highest = marks
                total_marks_sum += marks
                graded_count += 1
            elif submitted == "No":
                fail_count += 1

            row_vals = [
                sub.student.roll_number or str(row_idx-7).zfill(3),
                sub.student.username,
                sub.student.department or "---",
                submitted,
                sub_date,
                max_m,
                marks if marks is not None else "---",
                pct,
                status,
            ]
            for col_idx, val in enumerate(row_vals, 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.value = val
                c.font = Font(name="Arial", size=10, color=DARK_GRAY)
                c.fill = solid(LIGHT_GRAY if row_idx % 2 == 0 else WHITE)
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = thin_border()
                if col_idx == 9:  # Status
                    if val == "Pass":
                        c.font = Font(name="Arial", size=10, bold=True, color=GREEN_TEXT)
                        c.fill = solid(GREEN_BG)
                    elif val == "Fail":
                        c.font = Font(name="Arial", size=10, bold=True, color=RED_TEXT)
                        c.fill = solid(RED_BG)

        # Summary row
        last_data_row = 7 + len(sub_list)
        summary_row = last_data_row + 2
        total_students = len(sub_list)
        submitted_count = sum(1 for s in sub_list if s.file or s.text_entry or s.url_entry)
        class_avg = f"{(total_marks_sum/graded_count/max_marks*100):.1f}%" if graded_count > 0 else "---"

        summary_items = [
            ("A", f"Total Students: {total_students}"), ("B", f"Submitted: {submitted_count}"),
            ("C", f"Not Submitted: {total_students-submitted_count}"), ("D", f"Passed: {pass_count}"),
            ("E", f"Failed: {fail_count}"), ("G", f"Highest Mark: {highest}"), ("H", f"Class Average: {class_avg}"),
        ]
        for col_letter, val in summary_items:
            c = ws[f"{col_letter}{summary_row}"]
            c.value = val
            c.font = Font(name="Arial", size=9, bold=True, color=WHITE)
            c.fill = solid(MED_BLUE)
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border()

        # Signature row
        sig_row = summary_row + 2
        ws.merge_cells(f"A{sig_row}:C{sig_row}")
        ws[f"A{sig_row}"].value = "Teacher Signature"
        ws[f"A{sig_row}"].font = Font(name="Arial", size=9, bold=True, color=DARK_GRAY)
        ws[f"A{sig_row}"].fill = solid(LIGHT_GRAY)
        ws[f"A{sig_row}"].alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells(f"G{sig_row}:I{sig_row}")
        ws[f"G{sig_row}"].value = "Head of Department Signature"
        ws[f"G{sig_row}"].font = Font(name="Arial", size=9, bold=True, color=DARK_GRAY)
        ws[f"G{sig_row}"].fill = solid(LIGHT_GRAY)
        ws[f"G{sig_row}"].alignment = Alignment(horizontal="center", vertical="center")

    from io import BytesIO
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    response = HttpResponse(
        buffer.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response['Content-Disposition'] = 'attachment; filename="marksheets.zip"'
    return response