from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CalendarEventViewSet, calendar_feed, AnnouncementViewSet

router = DefaultRouter()
router.register("events", CalendarEventViewSet, basename="event")
router.register("announcements", AnnouncementViewSet, basename="announcement")

urlpatterns = router.urls + [
    path("calendar-feed/", calendar_feed),
]