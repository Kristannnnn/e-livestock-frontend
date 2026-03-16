function route(clean, legacy) {
  return { clean, legacy };
}

export const apiRoutes = {
  auth: {
    login: route("auth/login", "logIn.php"),
    register: route("auth/register", "register.php"),
    sendOtp: route("auth/send-otp", "send_otp.php"),
    verifyOtp: route("auth/verify-otp", "verify_otp.php"),
    resetPassword: route("auth/reset-password", "reset_password.php"),
  },
  profile: {
    info: route("accounts/user-info", "get_user_info.php"),
    update: route("accounts/update", "update_user.php"),
  },
  owner: {
    forms: route("forms/owner", "get_user_form.php"),
    schedules: route("schedules/owner", "get_schedules.php"),
  },
  appointments: {
    available: route("schedules/appointments/available", "get_appointments.php"),
    create: route("schedules/appointments/create", "create_appointments.php"),
  },
  inspector: {
    summary: route("analytics/inspection-summary", "get_inspection_summary.php"),
    createForm: route("forms/create", "create_form.php"),
    suggestions: route("dss/check-suggestion", "check_suggestion.php"),
    forms: route("forms/list", "get_forms.php"),
    formDetails: route("forms/details", "get_form_details.php"),
  },
  antemortem: {
    analytics: route("analytics/antemortem", "get_antemortem_analytics.php"),
    schedules: {
      pending: route("schedules/antemortem/pending", "get_pending_schedules.php"),
      accepted: route(
        "schedules/antemortem/accepted",
        "get_accepted_schedules.php"
      ),
      ongoing: route("schedules/antemortem/ongoing", "get_ongoing_schedules.php"),
      done: route("schedules/antemortem/done", "get_done_schedules.php"),
      cancelled: route(
        "schedules/antemortem/cancelled",
        "get_cancelled_schedules.php"
      ),
    },
    updateScheduleStatus: route(
      "schedules/antemortem/update-status",
      "update_schedule_status.php"
    ),
    cancelSchedule: route(
      "schedules/antemortem/cancel",
      "cancel_antemortem_schedules.php"
    ),
    verifyQr: route("verification/qr", "verify_qr.php"),
  },
};
