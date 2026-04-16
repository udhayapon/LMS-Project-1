from django.db import models
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver


User = get_user_model()


# ===================== COURSE MODEL =====================
class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()

    # Each course is assigned to a teacher
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'teacher'},   # Only users with role=teacher
        related_name='teaching_courses'
    )
    department = models.CharField(max_length=50, default='General')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.teacher.username}"
    

# ===================== ENROLLMENT MODEL =====================
class Enrollment(models.Model):
    # Student enrolling
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'},   # Only users with role=student
        related_name='enrollments'
    )

    # Course being enrolled
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments'
    )

    enrolled_at = models.DateTimeField(auto_now_add=True)

    # Prevent duplicate enrollment
    class Meta:
        unique_together = ['student', 'course']
        ordering = ['-enrolled_at']   # Latest first

    def __str__(self):
        return f"{self.student.username} enrolled in {self.course.title}"
    

# ==================teacher===================================================================================

#===============assignments=============================
class Assignment(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    max_marks = models.IntegerField(default=100)
    target_group = models.CharField(max_length=100, default="All Students")
    allowed_types = models.CharField(max_length=200, default="PDF,DOCX")
    reference_file = models.FileField(upload_to='assignments/references/', null=True, blank=True)

#=====================================submission=============================

class Submission(models.Model):

    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('evaluated', 'Evaluated'),
        ('late',      'Late'),
    ]

    assignment   = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name='submissions'
    )
    student      = models.ForeignKey(
        User, on_delete=models.CASCADE,
        limit_choices_to={'role': 'student'},
        related_name='submissions'
    )

    # ── submission content (at least one must be provided) ──
    file         = models.FileField(upload_to='submissions/', null=True, blank=True)
    text_entry   = models.TextField(blank=True, default='')
    url_entry    = models.URLField(blank=True, default='')

    submitted_at = models.DateTimeField(auto_now_add=True)

    # ── grading (filled by teacher) ──
    marks        = models.FloatField(null=True, blank=True)
    feedback     = models.TextField(blank=True, default='')
    status       = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )

    class Meta:
        # one submission per student per assignment
        unique_together = ['assignment', 'student']
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.username} → {self.assignment.title} [{self.status}]"

    def save(self, *args, **kwargs):
        # Auto-mark as late if submitted after deadline
        if self.assignment.due_date and not self.pk:
            from django.utils import timezone
            if timezone.now() > self.assignment.due_date:
                self.status = 'late'
        super().save(*args, **kwargs)


#================================lectures==========================

class Lecture(models.Model):
    TYPES = [('recorded', 'Recorded'), ('live', 'Live')]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    lecture_type = models.CharField(max_length=20, choices=TYPES, default='recorded')
    video_file = models.FileField(upload_to='lectures/', null=True, blank=True)
    meeting_link = models.URLField(blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

#=======================notes==============================

class Note(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    chapter = models.CharField(max_length=200, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    file = models.FileField(upload_to='notes/')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

#============================live class===============================
class LiveSession(models.Model):
    title = models.CharField(max_length=200)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    time = models.TimeField(null=True, blank=True)
    duration = models.IntegerField(default=60)
    meeting_link = models.URLField(blank=True)
    agenda = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.username}"

#======================quiz==========================

class Quiz(models.Model):
    title = models.CharField(max_length=200)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    time_limit = models.IntegerField(default=30)
    available_from = models.DateField(null=True, blank=True)
    available_until = models.DateField(null=True, blank=True)
    total_marks = models.IntegerField(default=50)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

@receiver(post_save, sender=Quiz)
def notify_students_on_quiz_create(sender, instance, created, **kwargs):
    if created and instance.course:
        enrollments = Enrollment.objects.filter(course=instance.course)
        notifications = [
            Notification(
                user=enrollment.student,
                message=f"📝 New Quiz Available: '{instance.title}' in {instance.course.title}. "
                        f"Available from {instance.available_from} to {instance.available_until}. "
                        f"Total marks: {instance.total_marks}."
            )
            for enrollment in enrollments
        ]
        Notification.objects.bulk_create(notifications)

class Question(models.Model):
    TYPES = [('mcq', 'MCQ'), ('truefalse', 'True/False')]
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=TYPES, default='mcq')
    option_a = models.CharField(max_length=200, blank=True)
    option_b = models.CharField(max_length=200, blank=True)
    option_c = models.CharField(max_length=200, blank=True)
    option_d = models.CharField(max_length=200, blank=True)
    correct_answer = models.CharField(max_length=200, blank=True)
    marks = models.IntegerField(default=5)

# ===================== QUIZ ATTEMPT MODEL =====================
class QuizAttempt(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='attempts')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_attempts')
    answers = models.JSONField(default=dict)   # { "question_id": "selected_option" }
    score = models.IntegerField(default=0)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['quiz', 'student']   

#====================== mark ==============================
class Mark(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='marks')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='marks')
    assessment_type = models.CharField(max_length=50)
    marks_obtained = models.FloatField()
    max_marks = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} - {self.assessment_type} - {self.marks_obtained}/{self.max_marks}"
    
