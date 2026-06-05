from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (

    UserViewSet,

    DepartmentViewSet,

    login_view,

    admin_dashboard
)

router = DefaultRouter()

# ================= DEPARTMENTS FIRST =================
router.register(

    r'departments',

    DepartmentViewSet,

    basename='department'
)

# ================= USERS SECOND =================
router.register(

    r'',

    UserViewSet,

    basename='user'
)

urlpatterns = [

    # ================= LOGIN =================
    path(

        'login/',

        login_view
    ),

    # ================= ADMIN DASHBOARD =================
    path(

        'admin-dashboard/',

        admin_dashboard
    ),
]

urlpatterns += router.urls