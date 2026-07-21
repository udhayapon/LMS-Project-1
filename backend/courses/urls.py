from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import (

    # DASHBOARDS
    teacher_dashboard,
    admin_dashboard,
    parent_dashboard,

    # GENERATE ENROLLMENTS
    generate_enrollments,
    generate_fees,

     # ELECTIVES (student self-enrollment)
    my_electives,
    elective_enroll,

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
    MaterialFolderViewSet,

    # DISCUSSION
    DiscussionMessageViewSet,

    # NOTIFICATIONS
    NotificationViewSet,

    # FEEDBACK
    FeedbackViewSet,
    FeeViewSet,  

    my_progress,
    class_progress,

    #PARENTS
    manage_parents,
    update_parent_children,
    message_contacts,
    messages_with,
    chat_contacts,
    chat_with,

)

router = DefaultRouter()

# ================= COURSES =================
router.register(r'courses',CourseViewSet,basename='course')

router.register( r'years', YearViewSet, basename='year')

router.register(r'subjects',SubjectViewSet,basename='subject')

# ================= TEACHING =================
router.register( r'teaching-assignments', TeachingAssignmentViewSet, basename='ta')

router.register(r'enrollments',EnrollmentViewSet,basename='enrollment')

# ================= LECTURES =================
router.register(r'lectures',LectureViewSet,basename='lecture')

# ================= ASSIGNMENTS =================
router.register(r'assignments', AssignmentViewSet, basename='assignment')

router.register( r'submissions',SubmissionViewSet,basename='submission')

# ================= QUIZZES =================
router.register(r'quizzes', QuizViewSet, basename='quiz')

router.register(r'questions',QuestionViewSet,basename='question')

router.register( r'quiz-attempts', QuizAttemptViewSet, basename='quiz-attempt')

# ================= STUDY MATERIALS =================
router.register( r'study-materials', StudyMaterialViewSet, basename='study-material')

# ================= DISCUSSION =================
router.register(r'discussions',DiscussionMessageViewSet,basename='discussion')

# ================= NOTIFICATIONS =================
router.register(r'notifications', NotificationViewSet, basename='notification')

# ================= FEEDBACK =================
router.register(r'feedback', FeedbackViewSet, basename='feedback')

router.register(r'material-folders', MaterialFolderViewSet, basename='material-folders')
# ================= FEES =================
router.register(r'fees', FeeViewSet, basename='fee')

urlpatterns = [

    # ================= DASHBOARDS =================
    path('admin-dashboard/',admin_dashboard),
    path('teacher-dashboard/', teacher_dashboard),

    # ================= GENERATE ENROLLMENTS =================
    path('generate-enrollments/',generate_enrollments),
    path('generate-fees/', generate_fees),
    # ================= ELECTIVES =================
    path('my-electives/', my_electives),
    path('elective-enroll/', elective_enroll),
    
    path( 'my-progress/', my_progress),
    path('class-progress/',class_progress),

    # ================= FEES =================
    path('parent/dashboard/', parent_dashboard),
    
    # =================PARENTS=========================
    path('manage/parents/', manage_parents),
    path('manage/parents/<int:profile_id>/children/', update_parent_children),
    path('messages/contacts/', message_contacts),
    path('messages/with/<int:user_id>/', messages_with),
    path('chat/contacts/', chat_contacts),
    path('chat/with/<int:user_id>/', chat_with),

    # ================= API ROUTES =================
    path(
        '',
        include(router.urls)
    ),
]