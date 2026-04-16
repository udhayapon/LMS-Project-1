from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    CourseViewSet,
    EnrollmentViewSet,
    AssignmentViewSet,
    SubmissionViewSet,     
    LectureViewSet,
    NoteViewSet,
    LiveSessionViewSet,
    NotificationViewSet,
    QuizViewSet,
    QuestionViewSet,
    QuizAttemptViewSet,
    MarkViewSet,
    admin_dashboard,
    teacher_dashboard,
    teacher_students,
    download_marksheet,
    serve_note_file,
)

router = DefaultRouter()
router.register(r'courses',                   CourseViewSet,      basename='course')
router.register(r'enrollments',               EnrollmentViewSet,  basename='enrollment')
router.register(r'learning/assignments',      AssignmentViewSet,  basename='assignment')
router.register(r'learning/submissions',      SubmissionViewSet,  basename='submission')  
router.register(r'learning/lectures',         LectureViewSet,     basename='lecture')
router.register(r'learning/notes',            NoteViewSet,        basename='note')
router.register(r'learning/live-sessions',    LiveSessionViewSet, basename='livesession')
router.register(r'notifications',             NotificationViewSet,basename='notification')
router.register(r'learning/quizzes',          QuizViewSet,        basename='quiz')
router.register(r'learning/questions',        QuestionViewSet,    basename='question')
router.register(r'learning/quiz-attempts',    QuizAttemptViewSet, basename='quizattempt')
router.register(r'learning/marks',            MarkViewSet,        basename='mark')

urlpatterns = [
    path('admin-dashboard/',  admin_dashboard),
    path('teacher-dashboard/', teacher_dashboard),
    path('teacher-students/', teacher_students),
    path('download-marksheet/', download_marksheet),
    path('notes/file/<int:pk>/', serve_note_file, name='serve-note-file'),
]

urlpatterns += router.urls
