from django.db import models

from django.utils import timezone

class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('duty_leave', 'Duty Leave'),
    ]
    teaching_assignment = models.ForeignKey(
        "courses.TeachingAssignment",
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    student = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    hour = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='absent')
    marked_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendance_marked'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['teaching_assignment', 'student', 'date', 'hour'],
                name='unique_attendance_per_hour'
            )
        ]

    def __str__(self):
        return f"{self.student} - {self.date} Hour {self.hour} - {self.status}"
