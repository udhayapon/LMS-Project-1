from rest_framework import serializers
from django.utils import timezone

from .models import Attendance, ODRequest, StaffLeaveRequest
from .leave_service import affected_periods, count_leave_days, covering_warning


class AttendanceSerializer(serializers.ModelSerializer):

    student_name = serializers.CharField(source='student.username', read_only=True)
    student_roll_no = serializers.CharField(source='student.roll_number', read_only=True)
    subject_name = serializers.CharField(source='teaching_assignment.subject.name', read_only=True)
    course_name = serializers.CharField(source='teaching_assignment.course.name', read_only=True)
    year_number = serializers.IntegerField(source='teaching_assignment.year.year_number', read_only=True)
    semester = serializers.IntegerField(source='teaching_assignment.subject.semester', read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'teaching_assignment', 'student', 'student_name',
            'student_roll_no', 'subject_name', 'course_name',
            'year_number', 'semester',
            'date', 'hour', 'status', 'marked_by', 'created_at'
        ]
        read_only_fields = ['marked_by', 'created_at']


class ODRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True)
    student_roll_no = serializers.CharField(source='student.roll_number', read_only=True)
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ODRequest
        fields = [
            'id', 'student', 'student_name', 'student_roll_no',
            'from_date', 'to_date',
            'category', 'category_label', 'reason', 'proof',
            'status', 'stage',
            'tutor_remark', 'tutor_reviewed_at',
            'hod_remark', 'hod_reviewed_at',
            'created_at',
        ]
        read_only_fields = [
            'student', 'status', 'stage',
            'tutor_remark', 'tutor_reviewed_at',
            'hod_remark', 'hod_reviewed_at', 'created_at',
        ]

    def validate(self, data):
        if data['to_date'] < data['from_date']:
            raise serializers.ValidationError("to_date cannot be before from_date.")
        return data


# ============================================================================
#  STAFF LEAVE
# ============================================================================


class StaffLeaveRequestSerializer(serializers.ModelSerializer):
    """
    Read shape matches the field names used by the approved UI design, so the
    React screens can bind to it directly.
    """

    teacher_name = serializers.CharField(source="teacher.username", read_only=True)
    teacher_designation = serializers.CharField(
        source="teacher.get_sub_role_display", read_only=True
    )
    department_name = serializers.CharField(
        source="department.name", read_only=True, default=""
    )
    leave_type_label = serializers.CharField(
        source="get_leave_type_display", read_only=True
    )
    session_label = serializers.CharField(source="get_session_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    hod_name = serializers.CharField(source="hod.username", read_only=True, default="")
    backup_name = serializers.CharField(source="backup.username", read_only=True, default="")
    proof_url = serializers.SerializerMethodField()
    covering_warning = serializers.SerializerMethodField()

    class Meta:
        model = StaffLeaveRequest
        fields = [
            "id",
            "teacher", "teacher_name", "teacher_designation",
            "department", "department_name",
            "leave_type", "leave_type_label",
            "from_date", "to_date",
            "session", "session_label",
            "days", "reason",
            "proof", "proof_url",
            "status", "status_label",
            "hod", "hod_name", "hod_remark",
            "backup", "backup_name", "covering_warning",
            "decided_at", "created_at",
        ]
        read_only_fields = [
            "teacher", "department", "days",
            "status", "hod", "hod_remark", "backup", "decided_at", "created_at",
        ]

    def get_covering_warning(self, obj):
        """Warn the HOD while deciding. Only pending requests need it."""
        if obj.status != StaffLeaveRequest.Status.PENDING:
            return None
        return covering_warning(obj.teacher, obj.from_date, obj.to_date, exclude_id=obj.id)

    def get_proof_url(self, obj):
        """Permission-checked download link, not the raw /media/ path."""
        if not obj.proof:
            return None
        request = self.context.get("request")
        path = f"/api/users/staff-leave/{obj.id}/proof/"
        return request.build_absolute_uri(path) if request else path

    # ------------------------------------------------------------- validate --
    def validate(self, data):
        teacher = self.context["request"].user
        from_date = data["from_date"]
        to_date = data["to_date"]
        leave_type = data["leave_type"]
        session = data.get("session", StaffLeaveRequest.Session.FULL)

        if to_date < from_date:
            raise serializers.ValidationError(
                {"to_date": "The end date cannot be before the start date."}
            )

        if session != StaffLeaveRequest.Session.FULL and from_date != to_date:
            raise serializers.ValidationError(
                {"session": "A half day can only be applied for on a single date."}
            )

        # The server decides what "today" is. Never trust a date from the client.
        today = timezone.localdate()
        if from_date < today and leave_type not in StaffLeaveRequest.BACKDATED_ALLOWED:
            raise serializers.ValidationError(
                {"from_date": "This leave type cannot be applied for in the past."}
            )

        if leave_type in StaffLeaveRequest.PROOF_REQUIRED and not data.get("proof"):
            raise serializers.ValidationError(
                {"proof": "Attach proof for this leave type."}
            )

        days = count_leave_days(from_date, to_date, session)
        if days <= 0:
            raise serializers.ValidationError(
                {"from_date": "Those dates are holidays or non-working days."}
            )

        clash = (
            StaffLeaveRequest.objects
            .filter(
                teacher=teacher,
                status__in=[
                    StaffLeaveRequest.Status.PENDING,
                    StaffLeaveRequest.Status.APPROVED,
                    StaffLeaveRequest.Status.RECORDED,
                ],
                from_date__lte=to_date,
                to_date__gte=from_date,
            )
            .exclude(pk=self.instance.pk if self.instance else None)
            .first()
        )
        if clash:
            raise serializers.ValidationError(
                {"to_date": (
                    f"This overlaps your {clash.get_leave_type_display().lower()} "
                    f"from {clash.from_date.strftime('%d-%m-%Y')} "
                    f"to {clash.to_date.strftime('%d-%m-%Y')}."
                )}
            )

        data["days"] = days
        return data


class StaffLeaveRequestDetailSerializer(StaffLeaveRequestSerializer):
    """The Details view — same record plus the timetable periods it hits."""

    affected_periods = serializers.SerializerMethodField()
    substitute_status = serializers.SerializerMethodField()

    class Meta(StaffLeaveRequestSerializer.Meta):
        fields = StaffLeaveRequestSerializer.Meta.fields + [
            "affected_periods", "substitute_status",
        ]

    def get_affected_periods(self, obj):
        return affected_periods(obj.teacher, obj.from_date, obj.to_date, obj.session)

    def get_substitute_status(self, obj):
        # Placeholder until the substitution phase is built. Keeping the field
        # here means the UI does not change shape when that lands.
        return "not_arranged"