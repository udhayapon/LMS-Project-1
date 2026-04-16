# ===================== DJANGO =====================
from django.contrib.auth import authenticate

# ===================== DJANGO REST FRAMEWORK =====================
from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view
from rest_framework.response import Response

# ===================== LOCAL MODELS =====================
from .models import User

# ===================== LOCAL SERIALIZERS =====================
from .serializers import UserSerializer


# ==================================================================================
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    #  CREATE USER
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    #  UPDATE USER (handles password properly via serializer)
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    #  DELETE USER (FIXED)
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        #  Optional: prevent deleting admin
        if user.role == "admin":
            return Response(
                {"error": "Admin user cannot be deleted"},
                status=status.HTTP_403_FORBIDDEN
            )

        user.delete()
        return Response(
            {"message": "User deleted successfully"},
            status=status.HTTP_200_OK
        )


#  LOGIN VIEW
@api_view(['POST'])
def login_view(request):
    print(request.data)
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)

    if user:
        token, created = Token.objects.get_or_create(user=user)  
        return Response({
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "token": token.key  
        })

    return Response(
        {"error": "Invalid credentials"},
        status=status.HTTP_400_BAD_REQUEST
    )
