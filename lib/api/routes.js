function route(clean, legacy) {
  return { clean, legacy };
}

export const apiRoutes = {
  auth: {
    login: route("auth/login", "auth/logIn.php"),
    register: route("auth/register", "auth/register.php"),
    sendOtp: route("auth/send-otp", "auth/send_otp.php"),
    verifyOtp: route("auth/verify-otp", "auth/verify_otp.php"),
    resetPassword: route("auth/reset-password", "auth/reset_password.php"),
  },
  profile: {
    info: route("accounts/user-info", "accounts/get_user_info.php"),
    update: route("accounts/update", "accounts/update_user.php"),
  },
  owner: {
    forms: route("forms/owner", "forms/get_user_form.php"),
    schedules: route("schedules/owner", "schedules/get_schedules.php"),
  },
  appointments: {
    available: route(
      "schedules/appointments/available",
      "schedules/get_appointments.php"
    ),
    create: route(
      "schedules/appointments/create",
      "schedules/create_appointments.php"
    ),
  },
  inspector: {
    summary: route(
      "analytics/inspection-summary",
      "analytics/get_inspection_summary.php"
    ),
    createForm: route("forms/create", "forms/create_form.php"),
    suggestions: route("dss/check-suggestion", "dss/check_suggestion.php"),
    forms: route("forms/list", "forms/get_forms.php"),
    formDetails: route("forms/details", "forms/get_form_details.php"),
  },
  antemortem: {
    analytics: route(
      "analytics/antemortem",
      "analytics/get_antemortem_analytics.php"
    ),
    schedules: {
      pending: route(
        "schedules/antemortem/pending",
        "schedules/get_pending_schedules.php"
      ),
      accepted: route(
        "schedules/antemortem/accepted",
        "schedules/get_accepted_schedules.php"
      ),
      ongoing: route(
        "schedules/antemortem/ongoing",
        "schedules/get_ongoing_schedules.php"
      ),
      done: route("schedules/antemortem/done", "schedules/get_done_schedules.php"),
      cancelled: route(
        "schedules/antemortem/cancelled",
        "schedules/get_cancelled_schedules.php"
      ),
    },
    updateScheduleStatus: route(
      "schedules/antemortem/update-status",
      "schedules/update_schedule_status.php"
    ),
    cancelSchedule: route(
      "schedules/antemortem/cancel",
      "schedules/cancel_antemortem_schedules.php"
    ),
    verifyQr: route("verification/qr", "verification/verify_qr.php"),
  },
};
