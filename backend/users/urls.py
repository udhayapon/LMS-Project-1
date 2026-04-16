from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import UserViewSet, login_view

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')   # ✅ CORRECT

urlpatterns = [
    path('login/', login_view),
]

urlpatterns += router.urls
