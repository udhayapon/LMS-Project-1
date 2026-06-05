from rest_framework import serializers

from .models import TimeSlot, TimetableEntry


class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ["id", "period_no", "start_time", "end_time", "label", "is_break"]


class TimetableEntrySerializer(serializers.ModelSerializer):
    # everything below is read from the linked TeachingAssignment
    subject = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()
    course = serializers.SerializerMethodField()
    year_number = serializers.SerializerMethodField()
    semester = serializers.SerializerMethodField()
    class_label = serializers.SerializerMethodField()      # e.g. "CSE - Year 2"
    period_no = serializers.IntegerField(source="time_slot.period_no", read_only=True)
    day_display = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            "id", "assignment", "day_of_week", "day_display",
            "time_slot", "period_no",
            "subject", "teacher_name", "course", "year_number", "semester", "class_label",
        ]
        read_only_fields = ["day_display", "period_no"]

    def get_subject(self, obj):
        return obj.assignment.subject.name

    def get_teacher_name(self, obj):
        t = obj.assignment.teacher
        # prefer full name, fall back to username
        full = (t.get_full_name() or "").strip()
        return full or t.username

    def get_course(self, obj):
        return obj.assignment.course.name

    def get_year_number(self, obj):
        return obj.assignment.year.year_number

    def get_semester(self, obj):
        return obj.assignment.subject.semester

    def get_class_label(self, obj):
        # short tag used in the teacher's grid, e.g. "Computer Science - Year 2"
        return f"{obj.assignment.course.name} - Year {obj.assignment.year.year_number}"
    
# =====================================================
#  APPEND THIS to timetable/serializers.py
# =====================================================
from .models import Semester, Holiday   # add to existing imports at top


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Semester
        fields = ["id", "name", "start_date", "end_date", "is_active"]


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name"]