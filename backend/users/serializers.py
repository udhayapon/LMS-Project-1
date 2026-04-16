from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'password',
            'email',
            'role',
            'department',

            #  NEW FIELDS
            'roll_number',
            'employee_id'
        ]

        extra_kwargs = {
            'password': {'write_only': True},
            'roll_number': {'read_only': True},   
            'employee_id': {'read_only': True}   
        }

    # CREATE USER
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    #  UPDATE USER
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
