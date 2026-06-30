from django.urls import path

from .views import (
    AssignmentOptions,
    TimeSlotDetail,
    TimeSlotListCreate,
    TimetableDetail,
    TimetableListCreate,
    SemesterActive, HolidayListCreate, HolidayDetail,
    TimetableSubmit, TimetableApprovalStatus,
    TimetableApprovalList, TimetableApprovalAction,
)

urlpatterns = [
    # bell schedule
    path("timeslots/", TimeSlotListCreate.as_view(), name="timeslot-list-create"),
    path("timeslots/<int:pk>/", TimeSlotDetail.as_view(), name="timeslot-detail"),

    # ----- timetable approval workflow (specific routes BEFORE the <int:pk> catch) -----
    path("timetable/submit/", TimetableSubmit.as_view(), name="timetable-submit"),
    path("timetable/approval-status/", TimetableApprovalStatus.as_view(), name="timetable-approval-status"),
    path("timetable/approvals/", TimetableApprovalList.as_view(), name="timetable-approvals"),
    path("timetable/approvals/<int:pk>/action/", TimetableApprovalAction.as_view(), name="timetable-approval-action"),

    # subjects/teachers available for a class (builder helper)
    path("timetable/options/", AssignmentOptions.as_view(), name="timetable-options"),

    # timetable grid
    path("timetable/", TimetableListCreate.as_view(), name="timetable-list-create"),
    path("timetable/<int:pk>/", TimetableDetail.as_view(), name="timetable-detail"),

    # term + holidays
    path("semester/", SemesterActive.as_view(), name="semester-active"),
    path("holidays/", HolidayListCreate.as_view(), name="holiday-list-create"),
    path("holidays/<int:pk>/", HolidayDetail.as_view(), name="holiday-detail"),
]