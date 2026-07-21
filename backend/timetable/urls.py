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
    RoomListCreate, RoomDetail,
    ActivityTypeListCreate, ActivityTypeDetail,
    ClassActivityList, ClassActivityDetail,
    TimetableAvailability, TimetableAutoFill,
    TimetableBusy, TimetableMove,
)

urlpatterns = [
    # bell schedule
    path("timeslots/", TimeSlotListCreate.as_view(), name="timeslot-list-create"),
    path("timeslots/<int:pk>/", TimeSlotDetail.as_view(), name="timeslot-detail"),

    # ----- approval workflow (specific routes BEFORE the <int:pk> catch) -----
    path("timetable/submit/", TimetableSubmit.as_view(), name="timetable-submit"),
    path("timetable/approval-status/", TimetableApprovalStatus.as_view(), name="timetable-approval-status"),
    path("timetable/approvals/", TimetableApprovalList.as_view(), name="timetable-approvals"),
    path("timetable/approvals/<int:pk>/action/", TimetableApprovalAction.as_view(), name="timetable-approval-action"),

    # ----- builder helpers & AI (string routes, kept before <int:pk>) -----
    path("timetable/options/", AssignmentOptions.as_view(), name="timetable-options"),
    path("timetable/availability/", TimetableAvailability.as_view(), name="timetable-availability"),
    path("timetable/autofill/", TimetableAutoFill.as_view(), name="timetable-autofill"),
    path("timetable/busy/", TimetableBusy.as_view(), name="timetable-busy"),
    path("timetable/move/", TimetableMove.as_view(), name="timetable-move"),

    # timetable grid
    path("timetable/", TimetableListCreate.as_view(), name="timetable-list-create"),
    path("timetable/<int:pk>/", TimetableDetail.as_view(), name="timetable-detail"),

    # rooms (college-wide, admin-managed)
    path("rooms/", RoomListCreate.as_view(), name="room-list-create"),
    path("rooms/<int:pk>/", RoomDetail.as_view(), name="room-detail"),

    # activity types (college-wide catalogue)
    path("activity-types/", ActivityTypeListCreate.as_view(), name="activitytype-list-create"),
    path("activity-types/<int:pk>/", ActivityTypeDetail.as_view(), name="activitytype-detail"),

    # class activities ("this class has Library 1/week")
    path("class-activities/", ClassActivityList.as_view(), name="classactivity-list-create"),
    path("class-activities/<int:pk>/", ClassActivityDetail.as_view(), name="classactivity-detail"),

    # term + holidays
    path("semester/", SemesterActive.as_view(), name="semester-active"),
    path("holidays/", HolidayListCreate.as_view(), name="holiday-list-create"),
    path("holidays/<int:pk>/", HolidayDetail.as_view(), name="holiday-detail"),
]