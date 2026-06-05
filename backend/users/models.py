from django.contrib.auth.models import AbstractUser
from django.db import models


# ================= YEAR CHOICES =================
YEAR_CHOICES = (
    (1, "1st Year"),
    (2, "2nd Year"),
    (3, "3rd Year"),
    (4, "4th Year"),
)


# ================= SEMESTER CHOICES =================
SEMESTER_CHOICES = (
    (1, "Semester 1"),
    (2, "Semester 2"),
    (3, "Semester 3"),
    (4, "Semester 4"),
    (5, "Semester 5"),
    (6, "Semester 6"),
    (7, "Semester 7"),
    (8, "Semester 8"),
)


# ================= DEPARTMENT =================
class Department(models.Model):

    name = models.CharField(
        max_length=100,
        unique=True
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ================= USER =================
class User(AbstractUser):

    ROLE_CHOICES = (
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    )

    # ================= ROLE =================
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='student'
    )

    # ================= DEPARTMENT =================
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # ================= COURSE =================
    course = models.ForeignKey(
        'courses.Course',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # ================= STUDENT ROLL NUMBER =================
    roll_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        unique=True
    )

    # ================= TEACHER EMPLOYEE ID =================
    employee_id = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        unique=True
    )

    # ================= STUDENT YEAR =================
    year = models.IntegerField(
        choices=YEAR_CHOICES,
        null=True,
        blank=True
    )

    # ================= STUDENT SEMESTER =================
    semester = models.IntegerField(
        choices=SEMESTER_CHOICES,
        null=True,
        blank=True
    )

    # ================= SAVE =================
    def save(self, *args, **kwargs):

        # ================= SUPERUSER =================
        if self.is_superuser:
            self.role = "admin"

        # ================= STUDENT ROLL NUMBER =================
        if (
            self.role == "student"
            and not self.roll_number
        ):

            # ================= DEPARTMENT CODE =================
            if self.department:

                dept_code = (
                    self.department.name[:2]
                    .upper()
                )

            else:

                dept_code = "GN"

            # ================= FIND LAST STUDENT =================
            last_student = User.objects.filter(

                role="student",

                department=self.department,

                roll_number__isnull=False

            ).order_by(
                '-roll_number'
            ).first()

            # ================= START =================
            new_number = 1

            # ================= GET LAST NUMBER =================
            if (
                last_student
                and last_student.roll_number
            ):

                try:

                    last_number = int(
                        last_student.roll_number[-3:]
                    )

                    new_number = (
                        last_number + 1
                    )

                except:
                    pass

            # ================= FINAL ROLL NUMBER =================
            self.roll_number = (
                f"21{dept_code}{new_number:03d}"
            )

        # ================= TEACHER EMPLOYEE ID =================
        if (
            self.role == "teacher"
            and not self.employee_id
        ):

            last_teacher = User.objects.filter(
                role="teacher"
            ).order_by(
                '-employee_id'
            ).first()

            new_number = 1

            if (
                last_teacher
                and last_teacher.employee_id
            ):

                try:

                    last_number = int(
                        last_teacher.employee_id[-3:]
                    )

                    new_number = (
                        last_number + 1
                    )

                except:
                    pass

            self.employee_id = (
                f"TCH{new_number:03d}"
            )

        super().save(*args, **kwargs)

    # ================= STRING =================
    def __str__(self):

        return self.username