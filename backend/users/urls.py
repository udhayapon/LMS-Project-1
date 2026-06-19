from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    UserViewSet,
    DepartmentViewSet,
    login_view,
    admin_dashboard,
    change_password,
    student_template,
    student_import,
    promote_students,
    my_department,
    hod_results,
    hod_attendance,
    
)

router = DefaultRouter()

router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'', UserViewSet, basename='user')

urlpatterns = [

    path('login/', login_view),
    path('admin-dashboard/', admin_dashboard),
    path('change-password/', change_password),
    path('student-template/', student_template),
    path('student-import/', student_import),
    path('promote-students/', promote_students),
    path('my-department/', my_department),
    path('hod-results/', hod_results),
    path('hod-attendance/', hod_attendance),
]

urlpatterns += router.urls