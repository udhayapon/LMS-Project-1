from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


# ===================== COURSE =====================
class Course(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True
    )

    def __str__(self):
        return self.name


# ===================== YEAR =====================
class Year(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="years"
    )

    year_number = models.IntegerField()

    class Meta:
        ordering = ['year_number']

        constraints = [
            models.UniqueConstraint(
                fields=['course', 'year_number'],
                name='unique_course_year'
            )
        ]

    def __str__(self):
        return f"{self.course.name} - Year {self.year_number}"


# ===================== SUBJECT =====================
class Subject(models.Model):

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

    name = models.CharField(
        max_length=100
    )

    year = models.ForeignKey(
        Year,
        on_delete=models.CASCADE,
        related_name="subjects"
    )

    # ================= SEMESTER =================
    semester = models.IntegerField(
        choices=SEMESTER_CHOICES,
        default = 1
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'name',
                    'year',
                    'semester'
                ],
                name='unique_subject_per_semester'
            )
        ]

    def __str__(self):

        return (
            f"{self.name} "
            f"(Year {self.year.year_number} "
            f"- Semester {self.semester})"
        )
    

# ===================== TEACHING ASSIGNMENT =====================
class TeachingAssignment(models.Model):

    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'teacher'}
    )

    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )

    year = models.ForeignKey(
        Year,
        on_delete=models.CASCADE
    )

    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'teacher',
                    'course',
                    'year',
                    'subject'
                ],
                name='unique_teaching_assignment'
            )
        ]

    # ================= VALIDATION =================
    def clean(self):

        if self.year.course != self.course:
            raise ValueError(
                "Selected year does not belong to this course"
            )

        if self.subject.year != self.year:
            raise ValueError(
                "Selected subject does not belong to this year"
            )

    def __str__(self):
        return (
            f"{self.teacher} → "
            f"{self.subject.name}"
        )


# ===================== ENROLLMENT =====================
class Enrollment(models.Model):

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'}
    )

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="enrollments"
    )

    enrolled_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'student',
                    'teaching_assignment'
                ],
                name='unique_student_subject_enrollment'
            )
        ]

    def __str__(self):
        return (
            f"{self.student} → "
            f"{self.teaching_assignment.subject.name}"
        )


# ===================== LECTURE =====================
class Lecture(models.Model):

    # ================= BASIC =================
    title = models.CharField(
        max_length=200
    )
    
    description = models.TextField(
        blank=True,
        null=True
    )

    chapter = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    # ================= SUBJECT =================
    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="lectures"
    )

    # ================= VIDEO =================
    video = models.FileField(
        upload_to='lectures/',
        blank=True,
        null=True
    )

    # ================= LIVE CLASS =================
    is_live = models.BooleanField(
        default=False
    )

    meeting_link = models.URLField(
        blank=True,
        null=True
    )

    scheduled_time = models.DateTimeField(
        blank=True,
        null=True
    )

    # ================= CREATED =================
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    def __str__(self):

        lecture_type = (
            "Live"
            if self.is_live
            else "Recorded"
        )

        return (
            f"{self.title} "
            f"({lecture_type})"
        )
# ===================== ASSIGNMENT =====================
class Assignment(models.Model):

    title = models.CharField(
        max_length=200
    )

    description = models.TextField(
        blank=True,
        null=True
    )

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="assignments"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    file = models.FileField(
        upload_to='assignments/',
        blank=True,
        null=True
    )

    due_date = models.DateTimeField(
        blank=True,
        null=True
    )

    total_marks = models.IntegerField(
        default=100
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    def __str__(self):
        return self.title


# ===================== SUBMISSION =====================

class Submission(models.Model):

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions"
    )

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    file = models.FileField(
        upload_to='submissions/'
    )

    submitted_at = models.DateTimeField(
        auto_now_add=True
    )

    # ================= MARKS =================
    marks = models.FloatField(
        blank=True,
        null=True
    )

    # ================= FEEDBACK =================
    feedback = models.TextField(
        blank=True,
        null=True
    )

    # ================= GRADED TIME =================
    graded_at = models.DateTimeField(
        blank=True,
        null=True
    )

    # ================= STATUS =================
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('evaluated', 'Evaluated'),
        ('late', 'Late'),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'assignment',
                    'student'
                ],
                name='unique_submission'
            )
        ]

    # ================= LATE SUBMISSION CHECK =================
    def save(self, *args, **kwargs):

        if (
            self.assignment.due_date
            and not self.pk
        ):

            if timezone.now() > self.assignment.due_date:

                self.status = 'late'

        super().save(*args, **kwargs)

    def __str__(self):

        return (
            f"{self.student} → "
            f"{self.assignment}"
        )


# ===================== QUIZ =====================
class Quiz(models.Model):

    title = models.CharField(
        max_length=200
    )

    description = models.TextField(
        blank=True,
        null=True
    )

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="quizzes"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    duration = models.IntegerField(
        default=10
    )

    total_marks = models.IntegerField(
        default=0
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    def __str__(self):
        return self.title


# ===================== QUESTION =====================
class Question(models.Model):

    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="questions"
    )

    text = models.TextField()

    option1 = models.CharField(
        max_length=200
    )

    option2 = models.CharField(
        max_length=200
    )

    option3 = models.CharField(
        max_length=200
    )

    option4 = models.CharField(
        max_length=200
    )

    correct_answer = models.IntegerField()

    marks = models.IntegerField(
        default=1
    )

    def __str__(self):
        return self.text


# ===================== QUIZ ATTEMPT =====================
class QuizAttempt(models.Model):

    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name="attempts"
    )

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    score = models.IntegerField(
        default=0
    )

    submitted_at = models.DateTimeField(
        default=timezone.now
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'quiz',
                    'student'
                ],
                name='unique_quiz_attempt'
            )
        ]

    def __str__(self):
        return (
            f"{self.student} → "
            f"{self.quiz}"
        )
    

# ===================== STUDY MATERIAL =====================
class StudyMaterial(models.Model):

    title = models.CharField(
        max_length=200
    )

    description = models.TextField(
        blank=True,
        null=True
    )

    file = models.FileField(
        upload_to='study_materials/'
    )

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="study_materials"
    )

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    def __str__(self):

        return self.title

# ===================== NOTIFICATION =====================
class Notification(models.Model):

    NOTIFICATION_TYPES = [

        ('assignment', 'Assignment'),
        ('lecture', 'Lecture'),
        ('quiz', 'Quiz'),
        ('material', 'Study Material'),
        ('discussion', 'Discussion'),
        ('marks', 'Marks Published'),
        ('announcement', 'Announcement'),

    ]

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications"
    )

    # NEW FIELD
    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications"
    )

    title = models.CharField(
        max_length=200
    )

    message = models.TextField()

    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPES,
        default='announcement'
    )

    is_read = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    def __str__(self):

        return (
            f"{self.recipient} → "
            f"{self.title}"
        )
    
# ================= DISCUSSION MESSAGE =================
class DiscussionMessage(models.Model):

    teaching_assignment = models.ForeignKey(
    TeachingAssignment,
    on_delete=models.CASCADE,
    related_name="discussions",
    null=True,
    blank=True
)

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    message = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self):

        return (
            f"{self.user.username}"
            f" - "
            f"{self.teaching_assignment.subject.name}"
        )


# ===================== FEEDBACK =====================
class Feedback(models.Model):

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.CASCADE,
        related_name="feedbacks"
    )

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedback_given",
        null=True,
        blank=True
    )

    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="feedback_received",
        null=True,
        blank=True
    )

    direction = models.CharField(
        max_length=3,
        choices=[
            ("t2s", "Teacher to Student"),
            ("s2t", "Student to Teacher"),
        ]
    )

    message = models.TextField()

    rating = models.IntegerField(
        null=True,
        blank=True
    )

    is_anonymous = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return (
            f"{self.direction} - "
            f"{self.teaching_assignment.subject.name}"
        )