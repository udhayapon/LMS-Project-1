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
    hod_tutor_overview,
    hod_tutor_grid,
    hod_assign_tutor,
    hod_remove_tutor,
    my_class,
    od_create,
    od_my_requests,
    od_cancel,
    tutor_od_pending,
    tutor_od_action,
    hod_od_pending,
    hod_od_action,
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

    # ================= HOD TUTOR =================
    path('hod-tutor-overview/', hod_tutor_overview),
    path('hod-tutor-grid/<int:course_id>/', hod_tutor_grid),
    path('hod-assign-tutor/', hod_assign_tutor),
    path('hod-remove-tutor/<int:tutor_id>/', hod_remove_tutor),

    path('my-class/', my_class),

    # ================= ON DUTY =================
    path('od/', od_my_requests),
    path('od/create/', od_create),
    path('od/<int:pk>/cancel/', od_cancel),
    path('tutor/od/', tutor_od_pending),
    path('tutor/od/<int:pk>/action/', tutor_od_action),
    path('hod/od/', hod_od_pending),
    path('hod/od/<int:pk>/action/', hod_od_action),
]

urlpatterns += router.urls