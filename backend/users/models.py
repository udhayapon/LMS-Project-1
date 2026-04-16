from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    )

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    department = models.CharField(max_length=50, default="General")

    #  NEW FIELDS
    roll_number = models.CharField(max_length=20, blank=True, null=True)
    employee_id = models.CharField(max_length=20, blank=True, null=True)

    #  AUTO GENERATION LOGIC
    def save(self, *args, **kwargs):

        # 🎓 STUDENT → AUTO ROLL NUMBER
        if self.role == "student" and not self.roll_number:
            last_student = User.objects.filter(role="student").order_by('-id').first()

            if last_student and last_student.roll_number:
                last_number = int(last_student.roll_number[-3:])
                new_number = last_number + 1
            else:
                new_number = 1

            dept_code = (self.department or "GEN")[:2].upper()
            self.roll_number = f"21{dept_code}{new_number:03d}"

        #  TEACHER → AUTO EMPLOYEE ID
        if self.role == "teacher" and not self.employee_id:
            last_teacher = User.objects.filter(role="teacher").order_by('-id').first()

            if last_teacher and last_teacher.employee_id:
                last_number = int(last_teacher.employee_id[-3:])
                new_number = last_number + 1
            else:
                new_number = 1

            self.employee_id = f"TCH{new_number:03d}"

        super().save(*args, **kwargs)