# ===================== IMPORTS =====================
from django.contrib.auth import authenticate

from rest_framework import ( viewsets,status)

from rest_framework.decorators import (api_view,permission_classes)

from rest_framework.response import Response

from rest_framework.permissions import (IsAuthenticated,AllowAny)

from rest_framework_simplejwt.tokens import ( RefreshToken)

from .models import (User,Department)

from .serializers import (UserSerializer,DepartmentSerializer)


# ===================== DEPARTMENT VIEWSET =====================
class DepartmentViewSet(viewsets.ModelViewSet):

    queryset = Department.objects.all()

    serializer_class = DepartmentSerializer

    permission_classes = [IsAuthenticated]


# ===================== USER VIEWSET =====================
class UserViewSet(viewsets.ModelViewSet):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        role = self.request.query_params.get(
            "role"
        )

        # ================= TEACHERS =================
        if role == "teacher":

            return User.objects.filter(
                role="teacher"
            ).order_by(
                "employee_id"
            )

        # ================= OTHER ROLES =================
        if role:

            return User.objects.filter(
                role=role
            )

        # ================= ALL USERS =================
        return User.objects.all()

    # ================= CREATE =================
    def create(self,request,*args,**kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # ================= UPDATE =================
    def update(
        self,
        request,
        *args,
        **kwargs
    ):

        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    # ================= DELETE =================
    def destroy(
        self,
        request,
        *args,
        **kwargs
    ):

        user = self.get_object()

        if user.role == "admin":

            return Response(

                {
                    "error":
                    "Admin user cannot be deleted"
                },

                status=status.HTTP_403_FORBIDDEN
            )

        user.delete()

        return Response(

            {
                "message":
                "User deleted successfully"
            },

            status=status.HTTP_200_OK
        )
    

# ===================== LOGIN API =====================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):

    username = request.data.get(
        "username"
    )

    password = request.data.get(
        "password"
    )

    if not username or not password:

        return Response(

            {
                "error":
                "Username and password required"
            },

            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(
        username=username,
        password=password
    )

    if user:

        refresh = RefreshToken.for_user(
            user
        )

        role = (
            "admin"
            if user.is_superuser
            else user.role
        )

        return Response({

            "access":
                str(refresh.access_token),

            "refresh":
                str(refresh),

            "id":
                user.id,

            "username":
                user.username,

            "email":
                user.email,

            "role":
                role,

            # ✅ DEPARTMENT
            "department":
                user.department.id
                if user.department
                else None,

            "department_name":
                user.department.name
                if user.department
                else None,

            "roll_number":
                user.roll_number,

            "employee_id":
                user.employee_id,

            "is_superuser":
                user.is_superuser
        })

    return Response(

        {
            "error":
            "Invalid credentials"
        },

        status=status.HTTP_400_BAD_REQUEST
    )


# ===================== ADMIN DASHBOARD =====================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):

    try:

        if (
            not request.user.is_superuser
            and
            request.user.role != "admin"
        ):

            return Response(

                {
                    "error":
                    "Access denied"
                },

                status=status.HTTP_403_FORBIDDEN
            )

        from courses.models import (
            Course,
            Enrollment
        )

        return Response({

            "total_users":
                User.objects.count(),

            "total_students":
                User.objects.filter(
                    role="student"
                ).count(),

            "total_teachers":
                User.objects.filter(
                    role="teacher"
                ).count(),

            "total_courses":
                Course.objects.count(),

            "total_enrollments":
                Enrollment.objects.count()
        })

    except Exception as e:

        print(
            "ADMIN DASHBOARD ERROR:",
            str(e)
        )

        return Response(
            {"error": str(e)},
            status=500
        )