from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    InternalAssessmentViewSet,
    IAMarkViewSet,
    SemesterResultViewSet,
    ExamScheduleViewSet,
    students_by_class,
    my_hall_ticket,
    hall_ticket_roster,
    generate_attendance_fines,
    set_revaluation_window,
    revaluation_window_status,
    my_revaluations,
    apply_revaluation,
    confirm_revaluation_payment,
    revaluation_review_list,
    process_revaluation,
    cancel_revaluation,
    results_template,
    results_import,
    ia_template,
    ia_import,
)

router = DefaultRouter()
router.register( "internal-assessments", InternalAssessmentViewSet, basename="internal-assessment")
router.register("ia-marks",IAMarkViewSet,basename="ia-mark",)
router.register("semester-results",SemesterResultViewSet,basename="semester-result",)
router.register("exam-schedules",ExamScheduleViewSet,basename="exam-schedule",)

urlpatterns = router.urls + [
    path("exam-students/", students_by_class),
    path("hall-ticket/", my_hall_ticket),
    path("hall-ticket/roster/", hall_ticket_roster),
    path("hall-ticket/generate-fines/", generate_attendance_fines),
    path("revaluation-window/", set_revaluation_window),
    path("revaluation-window/status/", revaluation_window_status),
    path("revaluations/", my_revaluations),
    path("revaluations/apply/", apply_revaluation),
    path("revaluations/<int:pk>/confirm-payment/", confirm_revaluation_payment),
    path("revaluations/review/", revaluation_review_list),
    path("revaluations/<int:pk>/process/", process_revaluation),
    path("revaluations/<int:pk>/cancel/", cancel_revaluation),
    path("results-template/", results_template),
    path("results-import/", results_import),
    path("ia-template/", ia_template),
    path("ia-import/", ia_import),
]