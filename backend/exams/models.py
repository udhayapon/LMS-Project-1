from django.db import models
from django.utils import timezone


# ===================== INTERNAL ASSESSMENT =====================
class InternalAssessment(models.Model):
    """
    One IA slot (IA1 / IA2 / IA3) for a given teaching assignment.
    The teacher enters marks; the admin reviews and locks to declare.
    """

    IA_CHOICES = [
        (1, "IA 1"),
        (2, "IA 2"),
        (3, "IA 3"),
    ]

    teaching_assignment = models.ForeignKey(
        "courses.TeachingAssignment",
        on_delete=models.CASCADE,
        related_name="internal_assessments"
    )

    number = models.IntegerField(
        choices=IA_CHOICES
    )

    max_marks = models.IntegerField(
        default=50
    )

    # Admin locks after review -> declared & visible to students
    is_locked = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(
                fields=["teaching_assignment", "number"],
                name="unique_ia_per_assignment"
            )
        ]

    def __str__(self):
        return (
            f"IA {self.number} - "
            f"{self.teaching_assignment.subject.name}"
        )


# ===================== IA MARK =====================
class IAMark(models.Model):
    """
    A single student's mark for one IA slot.
    """

    assessment = models.ForeignKey(
        InternalAssessment,
        on_delete=models.CASCADE,
        related_name="marks"
    )

    student = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="ia_marks",
        limit_choices_to={"role": "student"}
    )

    marks_obtained = models.FloatField(
        null=True,
        blank=True
    )

    is_absent = models.BooleanField(
        default=False
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["assessment", "student"],
                name="unique_ia_mark_per_student"
            )
        ]

    def __str__(self):
        return (
            f"{self.student} - "
            f"IA {self.assessment.number} - "
            f"{self.marks_obtained}"
        )
    
# ===================== SEMESTER RESULT =====================
class SemesterResult(models.Model):
    """
    A student's result for one semester. Groups all subject entries.
    Admin enters marks, then publishes to release to the student.
    """

    student = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="semester_results",
        limit_choices_to={"role": "student"},
    )

    semester = models.IntegerField()

    is_published = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    class Meta:
        ordering = ["-semester"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "semester"],
                name="unique_semester_result_per_student",
            )
        ]

    def __str__(self):
        return f"{self.student} - Semester {self.semester}"


# ===================== RESULT ENTRY =====================
class ResultEntry(models.Model):
    """
    One subject's mark inside a semester result.
    Grade + pass/fail are computed on save from scored/max.
    """

    result = models.ForeignKey(
        SemesterResult,
        on_delete=models.CASCADE,
        related_name="entries",
    )

    subject = models.ForeignKey(
        "courses.Subject",
        on_delete=models.CASCADE,
    )

    max_marks = models.IntegerField(
        default=100
    )

    marks_obtained = models.FloatField(
        null=True,
        blank=True
    )

    grade = models.CharField(
        max_length=2,
        blank=True
    )

    is_pass = models.BooleanField(
        default=False
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["result", "subject"],
                name="unique_result_entry_per_subject",
            )
        ]

    def __str__(self):
        return f"{self.result.student} - {self.subject.name} - {self.grade}"
    
# ===================== EXAM SCHEDULE =====================
class ExamSchedule(models.Model):
    """
    One exam slot: a subject's exam date + session (FN/AN) for a semester.
    Admin enters these; the hall ticket reads them.
    """

    SESSION_CHOICES = [
        ("FN", "Forenoon"),
        ("AN", "Afternoon"),
    ]

    subject = models.ForeignKey(
        "courses.Subject",
        on_delete=models.CASCADE,
        related_name="exam_schedules",
    )

    semester = models.IntegerField()

    exam_date = models.DateField()

    session = models.CharField(
        max_length=2,
        choices=SESSION_CHOICES,
        default="FN",
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    class Meta:
        ordering = ["exam_date", "session"]
        constraints = [
            models.UniqueConstraint(
                fields=["subject", "semester"],
                name="unique_exam_per_subject_semester",
            )
        ]

    def __str__(self):
        return f"{self.subject.name} - {self.exam_date} ({self.session})"

# ===================== REVALUATION REQUEST =====================
class RevaluationRequest(models.Model):
    """
    A student's request to re-evaluate one published subject mark.
    Flow: pending_payment -> pending_review -> revised | retained
    """

    STATUS_CHOICES = [
        ("pending_payment", "Pending Payment"),
        ("pending_review", "Pending Review"),
        ("revised", "Revised"),
        ("retained", "Retained"),
    ]

    student = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="revaluation_requests",
        limit_choices_to={"role": "student"},
    )

    # the published subject mark being challenged
    result_entry = models.ForeignKey(
        "ResultEntry",
        on_delete=models.CASCADE,
        related_name="revaluation_requests",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending_payment",
    )

    # snapshot of the mark at apply time + the revised mark after review
    original_marks = models.FloatField(
        null=True,
        blank=True,
    )

    revised_marks = models.FloatField(
        null=True,
        blank=True,
    )

    # the fee the student pays for this request
    fee = models.ForeignKey(
        "courses.Fee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revaluation_requests",
    )

    created_at = models.DateTimeField(
        default=timezone.now,
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "result_entry"],
                name="unique_revaluation_per_entry",
            )
        ]

    def __str__(self):
        return f"{self.student.username} - {self.result_entry} ({self.status})"
    
# ===================== REVALUATION WINDOW =====================
class RevaluationWindow(models.Model):
    """
    Controls when the revaluation portal is open for a semester,
    and the fee that applies while it's open. Admin opens/closes it.
    """

    semester = models.IntegerField(unique=True)

    is_open = models.BooleanField(default=False)

    fee_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    opened_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        state = "Open" if self.is_open else "Closed"
        return f"Semester {self.semester} Revaluation - {state}"