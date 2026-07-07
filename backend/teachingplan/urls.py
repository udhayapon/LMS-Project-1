# backend/teaching_plans/urls.py
from rest_framework.routers import DefaultRouter
from .views import TeachingPlanViewSet

router = DefaultRouter()
router.register(r"teaching-plans", TeachingPlanViewSet, basename="teaching-plans")

urlpatterns = router.urls