# ===================== IMPORTS =====================
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import viewsets
from rest_framework.decorators import (  api_view, permission_classes, action)
from rest_framework.permissions import ( IsAuthenticated, BasePermission, SAFE_METHODS)
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework import status

from .models import (
    Course,
    Year,
    Subject,
    TeachingAssignment,
    Enrollment,
    Lecture,
    Assignment,
    Submission,
    Quiz,
    Question,
    QuizAttempt,
    StudyMaterial,
    Notification,
    DiscussionMessage,
    Feedback,
)

from .serializers import (
    CourseSerializer,
    YearSerializer,
    SubjectSerializer,
    TeachingAssignmentSerializer,
    EnrollmentSerializer,
    LectureSerializer,
    AssignmentSerializer,
    SubmissionSerializer,
    QuizSerializer,
    QuestionSerializer,
    QuestionAdminSerializer,
    QuizAttemptSerializer,
    StudyMaterialSerializer,
    NotificationSerializer,
    DiscussionMessageSerializer,
    FeedbackSerializer,
)

User = get_user_model()

# ===================== PERMISSION =====================
class IsAdminOrTeacherOrReadOnly(BasePermission):

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated

        return (
            request.user.is_authenticated
            and request.user.role in ['teacher', 'admin']
        )

# ===================== HELPER =====================
def get_enrolled_ta_ids(user):
    """Return the teaching_assignment IDs the student is enrolled in."""
    return Enrollment.objects.filter(
        student=user
    ).values_list("teaching_assignment_id", flat=True)


# ===================== ADMIN DASHBOARD =====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if request.user.role != "admin":
        return Response({"error": "Unauthorized"}, status=403)

    return Response({
        "total_users": User.objects.count(),
        "total_students": User.objects.filter(role="student").count(),
        "total_teachers": User.objects.filter(role="teacher").count(),
        "total_courses": Course.objects.count(),
        "total_enrollments": Enrollment.objects.count(),
    })


# ===================== TEACHER DASHBOARD =====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def teacher_dashboard(request):
    if request.user.role != "teacher":
        return Response({"error": "Unauthorized"}, status=403)

    tas = TeachingAssignment.objects.filter(teacher=request.user)

    total_students = Enrollment.objects.filter(
        teaching_assignment__teacher=request.user
    ).count()

    return Response({
        "subjects": tas.count(),
        "students": total_students,
        "assignments": Assignment.objects.filter(
            teaching_assignment__teacher=request.user
        ).count(),
        "lectures": Lecture.objects.filter(
            teaching_assignment__teacher=request.user
        ).count(),
        "quizzes": Quiz.objects.filter(
            teaching_assignment__teacher=request.user
        ).count(),
        "materials": StudyMaterial.objects.filter(
            teaching_assignment__teacher=request.user
        ).count(),
    })


# ===================== COURSE =====================
class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().order_by("name")
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]


# ===================== YEAR =====================
class YearViewSet(viewsets.ModelViewSet):
    serializer_class = YearSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Year.objects.all()

        course = self.request.query_params.get("course")
        if course:
            queryset = queryset.filter(course_id=course)

        return queryset.select_related("course").order_by("year_number")


# ===================== SUBJECT =====================
class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Subject.objects.all()

        year = self.request.query_params.get("year")
        semester = self.request.query_params.get("semester")

        if year:
            queryset = queryset.filter(year_id=year)
        if semester:
            queryset = queryset.filter(semester=semester)

        return queryset.select_related(
            "year", "year__course"
        ).order_by("name")


# ===================== TEACHING ASSIGNMENT =====================
class TeachingAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = TeachingAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TeachingAssignment.objects.all()

        course = self.request.query_params.get("course")
        year = self.request.query_params.get("year")
        teacher = self.request.query_params.get("teacher")

        if course:
            queryset = queryset.filter(course_id=course)
        if year:
            queryset = queryset.filter(year_id=year)
        if teacher:
            queryset = queryset.filter(teacher_id=teacher)

        return queryset.select_related(
            "course", "year", "subject", "teacher"
        ).order_by("year__year_number")

    def perform_create(self, serializer):
        serializer.save()


# ===================== ENROLLMENT =====================
class EnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = Enrollment.objects.select_related(
            'student',
            'teaching_assignment',
            'teaching_assignment__teacher',
            'teaching_assignment__course',
            'teaching_assignment__year',
            'teaching_assignment__subject',
        )

        if user.role == "admin":
            return queryset
        elif user.role == "teacher":
            return queryset.filter(teaching_assignment__teacher=user)
        elif user.role == "student":
            return queryset.filter(student=user)

        return Enrollment.objects.none()

    def perform_create(self, serializer):
        serializer.save()


# ===================== LECTURE =====================
class LectureViewSet(viewsets.ModelViewSet):

    serializer_class = LectureSerializer
    permission_classes = [IsAdminOrTeacherOrReadOnly]

    def get_queryset(self):

        user = self.request.user

        queryset = Lecture.objects.select_related(
            "teaching_assignment",
            "created_by"
        )

        if user.role == "admin":
            pass

        elif user.role == "teacher":
            queryset = queryset.filter(
                teaching_assignment__teacher=user
            )

        elif user.role == "student":
            queryset = queryset.filter(
                teaching_assignment_id__in=get_enrolled_ta_ids(user)
            )

        else:
            return Lecture.objects.none()
        ta = self.request.query_params.get(
            "teaching_assignment"
        )

        if ta:
            queryset = queryset.filter(
                teaching_assignment_id=ta
            )

        return queryset.order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        lecture = serializer.save(
            created_by=self.request.user
        )

        students = Enrollment.objects.filter(
            teaching_assignment=
            lecture.teaching_assignment
        )

       # ================= STUDENT NOTIFICATIONS =================
        for e in students:

             Notification.objects.create(
                recipient=e.student,
                title="New Lecture Uploaded",
                message=f"{lecture.title} has been uploaded",
                notification_type='lecture',
                teaching_assignment=lecture.teaching_assignment
            )

# ================= TEACHER NOTIFICATION =================
        Notification.objects.create(
            recipient=lecture.teaching_assignment.teacher,
            title="Lecture Uploaded Successfully",
            message=f"You uploaded {lecture.title}",
            notification_type='lecture',
            teaching_assignment=lecture.teaching_assignment
        )

# ===================== ASSIGNMENT =====================
class AssignmentViewSet(viewsets.ModelViewSet):

    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminOrTeacherOrReadOnly]
    def get_queryset(self):

        user = self.request.user
        queryset = Assignment.objects.select_related(
            "teaching_assignment",
            "created_by"
        )

        if user.role == "admin":
            pass

        elif user.role == "teacher":
            queryset = queryset.filter(
                teaching_assignment__teacher=user
            )

        elif user.role == "student":
            queryset = queryset.filter(
             teaching_assignment_id__in=get_enrolled_ta_ids(user)
               )            

        else:
            return Assignment.objects.none()
        ta = self.request.query_params.get(
            "teaching_assignment"
        )

        if ta:
            queryset = queryset.filter(
                teaching_assignment_id=ta
            )

        return queryset.order_by(
            "-created_at"
        )

    # ================= CREATE =================
    def perform_create(self, serializer):

        assignment = serializer.save(
            created_by=self.request.user
        )

        students = Enrollment.objects.filter(
            teaching_assignment=
            assignment.teaching_assignment
        )

        # ================= STUDENT NOTIFICATIONS =================
        for e in students:

            Notification.objects.create(
                recipient=e.student,
                title="New Assignment",
                message=f"{assignment.title} has been uploaded",
                notification_type='assignment',
                teaching_assignment=assignment.teaching_assignment
            )

        # ================= TEACHER NOTIFICATION =================
        Notification.objects.create(
            recipient=assignment.teaching_assignment.teacher,
            title="Assignment Uploaded Successfully",
            message=f"You uploaded {assignment.title}",
            notification_type='assignment',
            teaching_assignment=assignment.teaching_assignment
        )

# ===================== SUBMISSION =====================
class SubmissionViewSet(viewsets.ModelViewSet):

    serializer_class = SubmissionSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        user = self.request.user

        queryset = Submission.objects.select_related(
            "assignment",
            "assignment__teaching_assignment",
            "assignment__teaching_assignment__subject",
            "assignment__teaching_assignment__course",
            "assignment__teaching_assignment__year",
            "student"
        )

        if user.role == "admin":

            pass

        elif user.role == "teacher":

            queryset = queryset.filter(
                assignment__teaching_assignment__teacher=user
            )

        elif user.role == "student":

            queryset = queryset.filter(
                student=user
            )

        else:

            return Submission.objects.none()

        assignment = self.request.query_params.get(
            "assignment"
        )

        if assignment:

            queryset = queryset.filter(
                assignment_id=assignment
            )

        return queryset.order_by(
            "-submitted_at"
        )

    # ================= CREATE / RESUBMIT =================
    def perform_create(self, serializer):

        assignment = serializer.validated_data.get(
            "assignment"
        )

        existing = Submission.objects.filter(
            student=self.request.user,
            assignment=assignment
        ).first()

        teacher = assignment.teaching_assignment.teacher

        # ================= RESUBMISSION =================
        if existing:

            existing.file = serializer.validated_data.get(
                "file"
            )

            existing.submitted_at = timezone.now()
            existing.marks = None
            existing.feedback = ""
            existing.graded_at = None

            if (
                assignment.due_date
                and timezone.now() > assignment.due_date
            ):

                existing.status = "late"

                # STUDENT NOTIFICATION
                Notification.objects.create(
                    recipient=self.request.user,
                    title="Late Assignment Resubmitted",
                    message=f"You resubmitted {assignment.title} after the deadline.",
                    notification_type="assignment",
                    teaching_assignment=assignment.teaching_assignment
                )

                # TEACHER NOTIFICATION
                Notification.objects.create(
                    recipient=teacher,
                    title="Late Resubmission Received",
                    message=f"{self.request.user.username} resubmitted {assignment.title} after the due date.",
                    notification_type="assignment",
                    teaching_assignment=assignment.teaching_assignment
                )

            else:

                existing.status = "pending"

            existing.save()

            # TEACHER NOTIFICATION
            Notification.objects.create(
                recipient=teacher,
                title="Assignment Resubmitted",
                message=f"{self.request.user.username} resubmitted {assignment.title}",
                notification_type="assignment",
                teaching_assignment=assignment.teaching_assignment
            )

            return

        # ================= NEW SUBMISSION =================
        submission = serializer.save(
            student=self.request.user
        )

        if (
            assignment.due_date
            and timezone.now() > assignment.due_date
        ):

            submission.status = "late"
            submission.save()

            # STUDENT NOTIFICATION
            Notification.objects.create(
                recipient=self.request.user,
                title="Late Assignment Submitted",
                message=f"You submitted {assignment.title} after the deadline.",
                notification_type="assignment",
                teaching_assignment=assignment.teaching_assignment
            )

            # TEACHER NOTIFICATION
            Notification.objects.create(
                recipient=teacher,
                title="Late Submission Received",
                message=f"{self.request.user.username} submitted {assignment.title} after the due date.",
                notification_type="assignment",
                teaching_assignment=assignment.teaching_assignment
            )

        # NORMAL TEACHER NOTIFICATION
        Notification.objects.create(
            recipient=teacher,
            title="New Assignment Submission",
            message=f"{self.request.user.username} submitted {assignment.title}",
            notification_type="assignment",
            teaching_assignment=assignment.teaching_assignment
        )

    # ================= UPDATE GRADING =================
    def perform_update(self, serializer):

        submission = serializer.save()

        if submission.marks is not None:

            submission.status = "evaluated"

            submission.graded_at = timezone.now()

            submission.save()

            # STUDENT NOTIFICATION
            Notification.objects.create(
                recipient=submission.student,
                title="Marks Published",
                message=f"Marks have been published for {submission.assignment.title}.",
                notification_type="assignment",
                teaching_assignment=submission.assignment.teaching_assignment
            )
        

# ===================== QUIZ =====================
class QuizViewSet(viewsets.ModelViewSet):

    serializer_class = QuizSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        user = self.request.user

        queryset = Quiz.objects.prefetch_related(
            "questions"
        ).select_related(
            "teaching_assignment",
            "created_by"
        )

        if user.role == "admin":

            pass

        elif user.role == "teacher":

            queryset = queryset.filter(
                teaching_assignment__teacher=user
            )

        elif user.role == "student":

            queryset = queryset.filter(
                teaching_assignment_id__in=
                get_enrolled_ta_ids(user)
            )

        else:

            return Quiz.objects.none()

        ta = self.request.query_params.get(
            "teaching_assignment"
        )

        if ta:

            queryset = queryset.filter(
                teaching_assignment_id=ta
            )

        return queryset.order_by(
            "-created_at"
        )

    # ================= CREATE QUIZ =================
    def perform_create(self, serializer):

        if self.request.user.role not in [
            "teacher",
            "admin"
        ]:

            raise ValidationError(
                "Only teachers can create quizzes"
            )

        quiz = serializer.save(
            created_by=self.request.user
        )

        students = Enrollment.objects.filter(
            teaching_assignment=
            quiz.teaching_assignment
        )

        # ================= STUDENT NOTIFICATIONS =================
        for e in students:

            Notification.objects.create(
                recipient=e.student,
                title="New Quiz Added",
                message=f"{quiz.title} is available now",
                notification_type='quiz',
                teaching_assignment=quiz.teaching_assignment
            )

        # ================= TEACHER NOTIFICATION =================
        Notification.objects.create(
            recipient=quiz.teaching_assignment.teacher,
            title="Quiz Created Successfully",
            message=f"You created {quiz.title}",
            notification_type='quiz',
            teaching_assignment=quiz.teaching_assignment
        )
    # ================= DELETE QUIZ =================
    def destroy(self, request, *args, **kwargs):

        if request.user.role not in [
            "teacher",
            "admin"
        ]:

            return Response(
                {
                    "error":
                    "Only teachers can delete quizzes"
                },
                status=403
            )

        return super().destroy(
            request,
            *args,
            **kwargs
        )

    # ================= SUBMIT QUIZ =================
    @action(detail=False, methods=['post'])
    def submit(self, request):

        quiz_id = request.data.get("quiz")

        answers = request.data.get(
            "answers",
            {}
        )

        try:

            quiz = Quiz.objects.prefetch_related(
                "questions"
            ).get(id=quiz_id)

        except Quiz.DoesNotExist:

            return Response(
                {"error": "Quiz not found"},
                status=404
            )

        already_attempted = QuizAttempt.objects.filter(
            quiz=quiz,
            student=request.user
        ).exists()

        if already_attempted:

            return Response(
                {
                    "error":
                    "You already attended this quiz"
                },
                status=400
            )

        score = 0

        for q in quiz.questions.all():

            selected_answer = answers.get(
                str(q.id)
            )

            if selected_answer is not None:

                try:

                    if int(selected_answer) == int(q.correct_answer):

                        score += q.marks

                except (ValueError, TypeError):

                    pass

        # ================= SAVE QUIZ ATTEMPT =================
        QuizAttempt.objects.create(

            quiz=quiz,
            student=request.user,
            score=score
        )

        # ================= TEACHER NOTIFICATION =================
        teacher = quiz.teaching_assignment.teacher

        Notification.objects.create(

            recipient=teacher,
            title="Quiz Submitted",
            message=f"{request.user.username} completed {quiz.title}",
            notification_type="quiz",
            teaching_assignment=quiz.teaching_assignment
        )

        return Response({

            "message": "Quiz submitted successfully",

            "score": score,

            "total_marks": quiz.total_marks
        })


# ===================== QUESTION =====================
class QuestionViewSet(viewsets.ModelViewSet):

    permission_classes = [
        IsAdminOrTeacherOrReadOnly
    ]

    # teachers/admins get the full serializer (with answer);
    # students get the safe one (no answer)
    def get_serializer_class(self):

        user = self.request.user

        if (
            user.is_authenticated
            and user.role in ['teacher', 'admin']
        ):
            return QuestionAdminSerializer

        return QuestionSerializer

    def get_queryset(self):

        queryset = Question.objects.all()

        quiz = self.request.query_params.get(
            "quiz"
        )

        if quiz:

            queryset = queryset.filter(
                quiz_id=quiz
            )

        return queryset.order_by("id")
    
# ===================== QUIZ ATTEMPT =====================
class QuizAttemptViewSet(viewsets.ModelViewSet):

    serializer_class = QuizAttemptSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        user = self.request.user

        queryset = QuizAttempt.objects.select_related(
            "quiz",
            "student"
        )

        if user.role == "admin":

            pass

        elif user.role == "teacher":

            queryset = queryset.filter(
                quiz__teaching_assignment__teacher=user
            )

        elif user.role == "student":

            queryset = queryset.filter(
                student=user
            )

        else:

            return QuizAttempt.objects.none()

        quiz_id = self.request.query_params.get(
            "quiz"
        )

        if quiz_id:

            queryset = queryset.filter(
                quiz_id=quiz_id
            )

        return queryset.order_by(
            "-submitted_at"
        )

    def perform_create(self, serializer):

        raise ValidationError.save(
            "Use the quiz submit endpoint to attempt a quiz."
        )

# ===================== STUDY MATERIAL =====================
class StudyMaterialViewSet(viewsets.ModelViewSet):

    serializer_class = StudyMaterialSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        user = self.request.user

        queryset = StudyMaterial.objects.select_related(
            "uploaded_by",
            "teaching_assignment",
            "teaching_assignment__teacher",
            "teaching_assignment__subject",
            "teaching_assignment__course",
            "teaching_assignment__year",
        )

        if user.role == "admin":
            pass

        elif user.role == "teacher":

            queryset = queryset.filter(
                teaching_assignment__teacher=user
            )

        elif user.role == "student":

            queryset = queryset.filter(
                teaching_assignment_id__in=
                get_enrolled_ta_ids(user)
            )

        else:
            return StudyMaterial.objects.none()

        ta = self.request.query_params.get(
            "teaching_assignment"
        )

        if ta:
            queryset = queryset.filter(
                teaching_assignment_id=ta
            )

        return queryset.order_by(
            "-created_at"
        )

    # ================= CREATE =================
    def perform_create(self, serializer):

        material = serializer.save(
            uploaded_by=self.request.user
        )

        students = Enrollment.objects.filter(
            teaching_assignment=
            material.teaching_assignment
        )

        # ================= STUDENT NOTIFICATIONS =================
        for e in students:
            Notification.objects.create(
                recipient=e.student,
                title="New Study Material",
                message=f"{material.title} has been uploaded",
                notification_type='material',
                teaching_assignment=material.teaching_assignment
            )

        # ================= TEACHER NOTIFICATION =================
        Notification.objects.create(
            recipient=material.teaching_assignment.teacher,
            title="Material Uploaded Successfully",
            message=f"You uploaded {material.title}",
            notification_type='material',
            teaching_assignment=material.teaching_assignment
        )

# ===================== NOTIFICATION =====================
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(
            recipient=self.request.user
        )

        unread = self.request.query_params.get("unread")
        if unread == "true":
            queryset = queryset.filter(is_read=False)

        return queryset.order_by("-created_at")

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({"message": "Notification marked as read"})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({"message": "All notifications marked as read"})
    

    # ================= GENERATE ENROLLMENTS =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_enrollments(request):

    if request.user.role != "admin":

        return Response(
            {
                "error": "Only admin can generate enrollments"
            },
            status=403
        )
    
    created_count = 0

    students = User.objects.filter(
        role='student'
    )

    for student in students:

        if (
            not student.course
            or not student.year
            or not student.semester
        ):
            continue

        teaching_assignments = TeachingAssignment.objects.filter(
            course=student.course,

            year__year_number=
            student.year,

            subject__semester=
            student.semester
        )

        for assignment in teaching_assignments:

            exists = Enrollment.objects.filter(
                student=student,
                teaching_assignment=assignment
            ).exists()

            if not exists:

                Enrollment.objects.create(
                    student=student,
                    teaching_assignment=assignment
                )

                created_count += 1

    return Response(
        {
            "message": "Enrollments generated successfully",
            "created": created_count
        },
        status=status.HTTP_200_OK
    )

# ===================== DISCUSSION MESSAGE =====================
class DiscussionMessageViewSet(viewsets.ModelViewSet):

    serializer_class = (
        DiscussionMessageSerializer
    )

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        queryset = (
            DiscussionMessage.objects
            .select_related(
                "user",
                "teaching_assignment"
            )
        )

        ta_id = (
            self.request.query_params.get(
                "teaching_assignment"
            )
        )

        if ta_id:

            queryset = queryset.filter(
                teaching_assignment_id=ta_id
            )

        return queryset.order_by(
            "created_at"
        )

    def perform_create(
        self,
        serializer
    ):

        discussion = serializer.save(
            user=self.request.user
        )

        ta = discussion.teaching_assignment

        # ================= TEACHER POSTS =================
        if self.request.user.role == "teacher":

            students = Enrollment.objects.filter(teaching_assignment=ta)

            for e in students:

                Notification.objects.create(
                    recipient=e.student,
                    title="New Discussion Message",

                    message=(
                        f"{self.request.user.username} "
                        f"posted in "
                        f"{ta.subject.name}"
                    ),

                    notification_type="discussion",
                    teaching_assignment=ta
                )

        # ================= STUDENT POSTS =================
        elif self.request.user.role == "student":

            Notification.objects.create(
                recipient=ta.teacher,
                title="New Discussion Message",
                message=(
                    f"{self.request.user.username} "
                    f"posted in "
                    f"{ta.subject.name}"
                ),

                notification_type="discussion",
                teaching_assignment=ta
            )


# ===================== FEEDBACK =====================
class FeedbackViewSet(viewsets.ModelViewSet):

    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        user = self.request.user

        queryset = Feedback.objects.select_related(
            "student",
            "teacher",
            "teaching_assignment",
            "teaching_assignment__subject"
        )

        if user.role == "teacher":

            return queryset.filter(
                teacher=user
            ).order_by("-created_at")

        elif user.role == "student":

            return queryset.filter(
                student=user
            ).order_by("-created_at")

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):

        user = self.request.user

        teaching_assignment = serializer.validated_data.get(
            "teaching_assignment"
        )

        # ================= STUDENT → TEACHER =================
        if user.role == "student":

            serializer.save(
                student=user,
                teacher=teaching_assignment.teacher,
                direction="s2t"
            )

        # ================= TEACHER → STUDENT =================
        elif user.role == "teacher":

            student = serializer.validated_data.get(
                "student"
            )

            serializer.save(
                teacher=user,
                student=student,
                direction="t2s"
            )