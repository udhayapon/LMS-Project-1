from django.shortcuts import render
from django.contrib.auth import get_user_model

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Attendance
from .serializers import AttendanceSerializer
from courses.views import get_parent_children
from courses.models import (
    TeachingAssignment,
    Enrollment
)

User = get_user_model()
# ===================== ATTENDANCE =====================
class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.select_related(
            'student', 'teaching_assignment'
        )
        if user.role == 'admin':
            pass
        elif user.role == 'teacher':
            queryset = queryset.filter(
                teaching_assignment__teacher=user
            )
        elif user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role == 'parent':
            children = get_parent_children(user)
            queryset = queryset.filter(student__in=children)
            child = self.request.query_params.get('child')
            if child:
                queryset = queryset.filter(student_id=child)
        else:
            return Attendance.objects.none()

        ta = self.request.query_params.get('teaching_assignment')
        if ta:
            queryset = queryset.filter(teaching_assignment_id=ta)

        date = self.request.query_params.get('date')
        if date:
            queryset = queryset.filter(date=date)

        from_date = self.request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(date__gte=from_date)

        to_date = self.request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(date__lte=to_date)

        return queryset.order_by('-date')

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)

   # ===================== BULK MARK =====================
    @action(detail=False, methods=['post'], url_path='bulk_mark')
    def bulk_mark(self, request):
        teaching_assignment_id = request.data.get('teaching_assignment')
        date = request.data.get('date')
        hour = request.data.get('hour')
        records = request.data.get('records', [])

        if not teaching_assignment_id or not date or not hour:
            return Response(
                {'error': 'teaching_assignment, date, and hour are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ta = TeachingAssignment.objects.get(id=teaching_assignment_id)
        except TeachingAssignment.DoesNotExist:
            return Response(
                {'error': 'Teaching assignment not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        from courses.signals import notify_parents
        saved = []
        for record in records:
            student_id = record.get('student')
            attendance_status = record.get('status', 'absent')
            
            # ── block if student is not enrolled in this teaching assignment ──
            is_enrolled = Enrollment.objects.filter(
                student_id=student_id,
                teaching_assignment=ta
            ).exists()
            
            if not is_enrolled:
                continue  # skip this record silently

            obj, created = Attendance.objects.update_or_create(
                teaching_assignment=ta,
                student_id=student_id,
                date=date,
                hour=hour,
                defaults={
                    'status': attendance_status,
                    'marked_by': request.user,
                }
            )
            saved.append(obj.id)

           # ── notify parent on absence / duty leave ──
            if attendance_status in ('absent', 'duty_leave'):
                child = User.objects.get(id=student_id)

                if attendance_status == 'duty_leave':
                    notify_parents(
                        child, "Marked on duty leave",
                        f"{child.username} was marked on duty leave in {ta.subject.name} (Hour {hour}).",
                        'announcement', ta)
                else:
                    recs = Attendance.objects.filter(student_id=student_id)
                    total = recs.count()
                    present = recs.filter(status='present').count()
                    pct = round(present / total * 100) if total else 0
                    if pct < 75:
                        notify_parents(
                            child, "Low attendance warning",
                            f"{child.username} attendance is {pct}% in {ta.subject.name} (Hour {hour}).",
                            'announcement', ta)
                    else:
                        notify_parents(
                            child, "Marked absent",
                            f"{child.username} was marked absent in {ta.subject.name} (Hour {hour}).",
                            'announcement', ta)

        return Response(
            {'message': f'{len(saved)} attendance records saved.', 'ids': saved},
            status=status.HTTP_200_OK
        )

     