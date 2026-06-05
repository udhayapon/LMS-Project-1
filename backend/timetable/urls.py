from django.urls import path

from .views import (
    AssignmentOptions,
    TimeSlotDetail,
    TimeSlotListCreate,
    TimetableDetail,
    TimetableListCreate,
    SemesterActive, HolidayListCreate, HolidayDetail 
)

urlpatterns = [
    # bell schedule
    path("timeslots/", TimeSlotListCreate.as_view(), name="timeslot-list-create"),
    path("timeslots/<int:pk>/", TimeSlotDetail.as_view(), name="timeslot-detail"),

    # timetable grid
    path("timetable/", TimetableListCreate.as_view(), name="timetable-list-create"),
    path("timetable/<int:pk>/", TimetableDetail.as_view(), name="timetable-detail"),

    # subjects/teachers available for a class (admin builder helper)
    path("timetable/options/", AssignmentOptions.as_view(), name="timetable-options"),

     path("semester/", SemesterActive.as_view(), name="semester-active"),
     path("holidays/", HolidayListCreate.as_view(), name="holiday-list-create"),
     path("holidays/<int:pk>/", HolidayDetail.as_view(), name="holiday-detail"),
 
]