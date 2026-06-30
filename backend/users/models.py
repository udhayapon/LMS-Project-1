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

    hod = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hod_of',
        limit_choices_to={'role': 'teacher'},
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
        ('parent', 'Parent'),
        ('accounts_admin', 'Accounts Admin'),
        ('exam_admin', 'Examination Admin'),
        ('academic_admin', 'Academic Admin'),
        ('iqac_admin', 'IQAC Admin'),
    )

    # ================= ROLE =================
    role = models.CharField(
        max_length=30,
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
    # ================= STUDENT BATCH / ADMISSION YEAR =================
    batch_year = models.IntegerField(
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
            DEPT_CODES = {
                "Computer Science": "CS",
                "Information Technology": "IT",
                "Electronics and Communication": "ECE",
                "Electrical and Electronics": "EEE",
                "Mechanical": "ME",
                "Civil": "CE",
                "Chemistry": "CH",
                "Mathematics": "MA",
            }

            if self.department:
                dept_code = DEPT_CODES.get(self.department.name, "GN")
            else:
                dept_code = "GN"

            # ================= YEAR PREFIX (from batch year) =================
            # batch_year 2021 -> "21". Falls back to current year if not set.
            import datetime
            batch = self.batch_year or datetime.date.today().year
            year_prefix = str(batch)[-2:]

            # ================= FIND LAST STUDENT IN SAME BATCH + DEPT =================
            # counter restarts per (department, batch year)
            last_student = User.objects.filter(
                role="student",
                department=self.department,
                roll_number__startswith=f"{year_prefix}{dept_code}",
            ).order_by('-roll_number').first()

            # ================= COMPUTE NEXT NUMBER =================
            new_number = 1
            if last_student and last_student.roll_number:
                try:
                    new_number = int(last_student.roll_number[-3:]) + 1
                except (ValueError, TypeError):
                    pass

            # ================= FINAL ROLL NUMBER =================
            self.roll_number = f"{year_prefix}{dept_code}{new_number:03d}"

        # ================= TEACHER EMPLOYEE ID =================
        if (
            self.role == "teacher"
            and not self.employee_id
        ):

            last_teacher = User.objects.filter(
                role="teacher"
            ).order_by('-employee_id').first()

            new_number = 1
            if last_teacher and last_teacher.employee_id:
                try:
                    new_number = int(last_teacher.employee_id[-3:]) + 1
                except (ValueError, TypeError):
                    pass

            self.employee_id = f"TCH{new_number:03d}"

        super().save(*args, **kwargs)

    # ================= STRING =================
    def __str__(self):
        return self.username


# ================= PARENT PROFILE =================
class ParentProfile(models.Model):

    user = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        related_name='parent_profile',
        limit_choices_to={'role': 'parent'},
    )

    children = models.ManyToManyField(
        'users.User',
        related_name='parents',
        limit_choices_to={'role': 'student'},
        blank=True,
    )

    def __str__(self):
        return self.user.username


# ================= FACULTY PARTICIPATION (IQAC) =================
# One row per activity a teacher records for NAAC/IQAC.
# The teacher fills this in and uploads a proof file.
# The IQAC admin only views and counts these — there is no approve/reject.
class FacultyParticipation(models.Model):

    # what kind of activity it was
    CATEGORY_CHOICES = (
        ('fdp', 'FDP / Training Attended'),
        ('workshop_attended', 'Workshop / Seminar Attended'),
        ('workshop_conducted', 'Workshop / Seminar Conducted'),
        ('conference', 'Conference Paper Presented'),
        ('journal', 'Journal Publication'),
        ('certification', 'Certification / MOOC (NPTEL etc.)'),
        ('guest_lecture', 'Guest Lecture Delivered'),
        ('committee', 'Committee / Cell Membership'),
        ('project', 'Project / Grant / Consultancy'),
        ('other', 'Other'),
    )

    # the teacher's part in it
    ROLE_CHOICES = (
        ('attended', 'Attended'),
        ('conducted', 'Conducted / Organized'),
        ('presented', 'Presented'),
        ('published', 'Published'),
        ('member', 'Member'),
        ('other', 'Other'),
    )

    faculty = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='participations',
        limit_choices_to={'role': 'teacher'},
    )

    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=255)            # e.g. "AI Workshop at IIT Madras"
    organizer = models.CharField(max_length=255, blank=True)   # where / who ran it
    activity_role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='attended')

    date = models.DateField()
    academic_year = models.CharField(max_length=9, blank=True)  # e.g. "2025-26"

    # the uploaded proof (certificate / PDF / image)
    proof = models.FileField(upload_to='faculty_proofs/', null=True, blank=True)

    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.faculty.username} — {self.get_category_display()} — {self.title}"