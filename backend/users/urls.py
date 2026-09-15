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
    hod_class_performance,
    hod_tutor_overview,
    hod_tutor_grid,
    hod_assign_tutor,
    hod_remove_tutor,
    my_class,
    tutor_student_report,
    my_class_marksheet,
    od_create,
    od_my_requests,
    od_cancel,
    tutor_od_pending,
    tutor_od_action,
    hod_od_pending,
    hod_od_action,
    staff_leave_create,
    staff_leave_my,
    staff_leave_detail,
    staff_leave_cancel,
    staff_leave_preview,
    staff_leave_proof,
    hod_staff_leave_pending,
    hod_staff_leave_history,
    hod_staff_leave_on_leave_today,
    hod_staff_leave_action,
    participation_create,
    participation_my,
    participation_delete,
    iqac_participation_list,
    iqac_participation_summary,
    iqac_academic_quality,
    hod_allocation_subjects,
    hod_allocate,
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
    path('hod-class-performance/', hod_class_performance),

    # ================= HOD TUTOR =================
    path('hod-tutor-overview/', hod_tutor_overview),
    path('hod-tutor-grid/<int:course_id>/', hod_tutor_grid),
    path('hod-assign-tutor/', hod_assign_tutor),
    path('hod-remove-tutor/<int:tutor_id>/', hod_remove_tutor),
    # ================= HOD FACULTY ALLOCATION =================
    path('hod/allocation/', hod_allocation_subjects),
    path('hod/allocate/', hod_allocate),

    path('my-class/', my_class),
    path('my-class/student/<int:student_id>/report/', tutor_student_report),
    path('my-class/marksheet/', my_class_marksheet),

    # ================= ON DUTY =================
    path('od/', od_my_requests),
    path('od/create/', od_create),
    path('od/<int:pk>/cancel/', od_cancel),
    path('tutor/od/', tutor_od_pending),
    path('tutor/od/<int:pk>/action/', tutor_od_action),
    path('hod/od/', hod_od_pending),
    path('hod/od/<int:pk>/action/', hod_od_action),

    # ================= STAFF LEAVE =================
    path('staff-leave/',                     staff_leave_my),
    path('staff-leave/create/',              staff_leave_create),
    path('staff-leave/preview/',             staff_leave_preview),
    path('staff-leave/<int:pk>/',            staff_leave_detail),
    path('staff-leave/<int:pk>/cancel/',     staff_leave_cancel),
    path('staff-leave/<int:pk>/proof/',      staff_leave_proof),
    path('hod/staff-leave/',                 hod_staff_leave_pending),
    path('hod/staff-leave/history/',         hod_staff_leave_history),
    path('hod/staff-leave/on-leave-today/',  hod_staff_leave_on_leave_today),
    path('hod/staff-leave/<int:pk>/action/', hod_staff_leave_action),

    # ================= FACULTY PARTICIPATION (IQAC) =================
    path('participation/', participation_my),
    path('participation/add/', participation_create),
    path('participation/<int:pk>/delete/', participation_delete),
    path('iqac/participation/', iqac_participation_list),
    path('iqac/participation/summary/', iqac_participation_summary),

    # ================= IQAC ACADEMIC QUALITY =================
    path('iqac/academic-quality/', iqac_academic_quality),
]

urlpatterns += router.urls