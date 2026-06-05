from rest_framework import serializers

from .models import (
    User,
    Department
)


# ================= DEPARTMENT =================
class DepartmentSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = Department
        fields = [
            'id',
            'name'
        ]


# ================= USER =================
class UserSerializer(
    serializers.ModelSerializer
):

    # ================= DEPARTMENT NAME =================
    department_name = serializers.CharField(
        source='department.name',
        read_only=True
    )

    # ================= COURSE NAME =================
    course_name = serializers.CharField(
        source='course.name',
        read_only=True
    )

    # ================= DEPARTMENT CODE =================
    department_code = serializers.SerializerMethodField()

    class Meta:

        model = User

        fields = [
            'id',
            'username',
            'password',
            'email',
            'role',
            'department',
            'department_name',
            'department_code',
            'course',
            'course_name',
            'roll_number',
            'employee_id',
            'year',
            'semester'
        ]

        extra_kwargs = {
            'password': {
                'write_only': True,
                'required': False
            },

            'email': {
                'required': True
            },

            'roll_number': {
              'read_only': True
            },

            'employee_id': {
                'read_only': True
            }
        }

    # ================= DEPARTMENT CODE METHOD =================
    def get_department_code(
        self,
        obj
    ):

        if obj.department:

            return (
                obj.department.name[:3]
                .upper()
            )

        return ""

    # ================= VALIDATE USERNAME =================
    def validate_username(
        self,
        value
    ):

        if not value:

            raise serializers.ValidationError(
                "Username is required"
            )

        return value

    # ================= VALIDATE EMAIL =================
    def validate_email(
        self,
        value
    ):

        if not value:
            raise serializers.ValidationError(
                "Email is required"
            )

        user = self.instance

        if user:

            if User.objects.filter(
                email=value
            ).exclude(
                id=user.id
            ).exists():

                raise serializers.ValidationError(
                    "Email already exists"
                )

        else:

            if User.objects.filter(
                email=value
            ).exists():

                raise serializers.ValidationError(
                    "Email already exists"
                )

        return value

    # ================= VALIDATE ROLE =================
    def validate_role(
        self,
        value
    ):

        valid_roles = [
            'student',
            'teacher',
            'admin'
        ]

        if value not in valid_roles:

            raise serializers.ValidationError(
                "Invalid role"
            )

        return value

    # ================= CREATE USER =================
    def create(
        self,
        validated_data
    ):

        password = validated_data.pop(
            'password',
            None
        )

        user = User(
            **validated_data
        )

        if password:

            user.set_password(
                password
            )

        else:

            user.set_password(
                User.objects.make_random_password()
            )

        user.save()

        return user

    # ================= UPDATE USER =================
    def update(
        self,
        instance,
        validated_data
    ):

        password = validated_data.pop(
            'password',
            None
        )

        for attr, value in validated_data.items():

            setattr(
                instance,
                attr,
                value
            )

        if password:

            instance.set_password(
                password
            )

        instance.save()

        return instance