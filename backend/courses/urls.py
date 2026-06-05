from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import (

    # DASHBOARDS
    teacher_dashboard,
    admin_dashboard,

    # GENERATE ENROLLMENTS
    generate_enrollments,

    # MAIN
    CourseViewSet,
    YearViewSet,
    SubjectViewSet,
    TeachingAssignmentViewSet,
    EnrollmentViewSet,

    # LECTURES
    LectureViewSet,

    # ASSIGNMENTS
    AssignmentViewSet,
    SubmissionViewSet,

    # QUIZZES
    QuizViewSet,
    QuestionViewSet,
    QuizAttemptViewSet,

    # STUDY MATERIALS
    StudyMaterialViewSet,

    # DISCUSSION
    DiscussionMessageViewSet,

    # NOTIFICATIONS
    NotificationViewSet,

    # FEEDBACK
    FeedbackViewSet,
)

router = DefaultRouter()

# ================= COURSES =================
router.register(
    r'courses',
    CourseViewSet,
    basename='course'
)

router.register(
    r'years',
    YearViewSet,
    basename='year'
)

router.register(
    r'subjects',
    SubjectViewSet,
    basename='subject'
)

# ================= TEACHING =================
router.register(
    r'teaching-assignments',
    TeachingAssignmentViewSet,
    basename='ta'
)

router.register(
    r'enrollments',
    EnrollmentViewSet,
    basename='enrollment'
)

# ================= LECTURES =================
router.register(
    r'lectures',
    LectureViewSet,
    basename='lecture'
)

# ================= ASSIGNMENTS =================
router.register(
    r'assignments',
    AssignmentViewSet,
    basename='assignment'
)

router.register(
    r'submissions',
    SubmissionViewSet,
    basename='submission'
)

# ================= QUIZZES =================
router.register(
    r'quizzes',
    QuizViewSet,
    basename='quiz'
)

router.register(
    r'questions',
    QuestionViewSet,
    basename='question'
)

router.register(
    r'quiz-attempts',
    QuizAttemptViewSet,
    basename='quiz-attempt'
)

# ================= STUDY MATERIALS =================
router.register(
    r'study-materials',
    StudyMaterialViewSet,
    basename='study-material'
)

# ================= DISCUSSION =================
router.register(
    r'discussions',
    DiscussionMessageViewSet,
    basename='discussion'
)

# ================= NOTIFICATIONS =================
router.register(
    r'notifications',
    NotificationViewSet,
    basename='notification'
)

# ================= FEEDBACK =================
router.register(
    r'feedback',
    FeedbackViewSet,
    basename='feedback'
)

urlpatterns = [

    # ================= DASHBOARDS =================
    path(
        'admin-dashboard/',
        admin_dashboard
    ),

    path(
        'teacher-dashboard/',
        teacher_dashboard
    ),

    # ================= GENERATE ENROLLMENTS =================
    path(
        'generate-enrollments/',
        generate_enrollments
    ),

    # ================= API ROUTES =================
    path(
        '',
        include(router.urls)
    ),
]