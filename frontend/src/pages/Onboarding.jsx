import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Armchair,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  Copy,
  Link2,
  Mail,
  MessageSquare,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import AvatarPicker from "../components/AvatarPicker";
import { avatarSrc } from "../lib/avatars";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import {
  normalizeHexColor,
  onboardingErrorMessage,
  ONBOARDING_COLORS,
} from "../lib/onboarding";
import { getPushPermission, isPushSupported, subscribeToPush } from "../lib/push";

const TOTAL_STEPS = 6;
const NO_CONTACT_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-form-type": "other",
};

export default function Onboarding() {
  const { user, updateMe } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(normalizeHexColor(user?.color));
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [phone, setPhone] = useState(user?.phone || "");
  const [autoSms, setAutoSms] = useState(Boolean(user?.auto_sms));
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tableName, setTableName] = useState("");
  const [tableColor, setTableColor] = useState("#34C759");
  const [tableActive, setTableActive] = useState(true);
  const [createdTable, setCreatedTable] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setPushEnabled(getPushPermission() === "granted");
    api.get("/bridges/status")
      .then((response) => setSmsConfigured(Boolean(response.data?.sms_configured)))
      .catch(() => setSmsConfigured(false));
  }, []);

  useEffect(() => {
    setActionError("");
    cardRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const runAction = async (action) => {
    if (busy) return null;
    setBusy(true);
    setActionError("");
    try {
      return await action();
    } catch (error) {
      const message = onboardingErrorMessage(error);
      setActionError(message);
      toast.error(message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const completeOnboarding = (completed) => {
    localStorage.setItem("rt-onboarded", "true");
    localStorage.setItem("rt-onboard-completed", JSON.stringify(completed));
    navigate("/", { replace: true });
  };

  const finish = () => runAction(async () => {
    const updates = {
      onboarded: true,
      color: normalizeHexColor(color),
      avatar_url: avatarUrl,
      auto_sms: autoSms,
    };
    if (name.trim().length >= 2) updates.name = name.trim();
    if (phone.trim()) updates.phone = phone.trim();

    await updateMe(updates);
    completeOnboarding({
      profile: name.trim().length >= 2,
      avatar: Boolean(avatarUrl),
      phone: Boolean(phone.trim()),
      push: pushEnabled,
      table: Boolean(createdTable),
    });
  });

  const skipAll = () => runAction(async () => {
    await updateMe({ onboarded: true });
    completeOnboarding({
      profile: false,
      avatar: false,
      phone: false,
      push: false,
      table: false,
    });
  });

  const saveProfile = () => runAction(async () => {
    await updateMe({
      name: name.trim(),
      color: normalizeHexColor(color),
      avatar_url: avatarUrl,
    });
    setStep(3);
  });

  const saveConnectivity = () => runAction(async () => {
    const updates = { auto_sms: autoSms };
    if (phone.trim()) updates.phone = phone.trim();
    await updateMe(updates);
    setStep(4);
  });

  const enablePush = () => runAction(async () => {
    const enabled = await subscribeToPush();
    setPushEnabled(enabled);
    if (!enabled) {
      throw new Error("Push permission was not granted. You can enable it later in Settings.");
    }
    toast.success("Push notifications enabled");
  });

  const createTable = () => runAction(async () => {
    if (!tableName.trim()) {
      throw new Error("Give your table a name before continuing.");
    }
    const { data } = await api.post("/tables", {
      name: tableName.trim(),
      color: normalizeHexColor(tableColor, "#34C759"),
      active: tableActive,
    });
    setCreatedTable(data);
    setStep(5);
  });

  const generateInvite = () => runAction(async () => {
    if (!createdTable) {
      throw new Error("Create a table before generating its invite code.");
    }
    const { data } = await api.post("/invites", {
      table_id: createdTable.id,
      max_uses: 50,
      expires_in_days: 30,
    });
    setInviteCode(data.code);
    toast.success("Invite code ready");
  });

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast.success("Invite code copied");
    } catch {
      setActionError("Your browser blocked clipboard access. Select the code and copy it manually.");
    }
  };

  const shareInvite = (channel) => {
    if (!inviteCode) return;
    const body = `Join my Roundtable_VO table with code ${inviteCode}`;
    if (channel === "sms") {
      window.location.href = `sms:?&body=${encodeURIComponent(body)}`;
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent("Join my Roundtable_VO table")}&body=${encodeURIComponent(body)}`;
    }
  };

  const goBack = () => {
    if (busy || step <= 1) return;
    if (step === 6 && createdTable) setStep(5);
    else setStep((current) => Math.max(1, current - 1));
  };

  return (
    <div className="onboard-bg onboard-bg--scrollable">
      <main
        className="onboard-card onboard-card--setup"
        data-testid="onboarding-card"
        ref={cardRef}
        aria-labelledby="onboarding-title"
      >
        <header className="onboard-header">
          <div>
            <div className="onboard-eyebrow">ACCOUNT SETUP</div>
            <div className="onboard-session"><ShieldCheck size={13} /> Signed in as {user?.email}</div>
          </div>
          <div className="onboard-step-count">Step {step} of {TOTAL_STEPS}</div>
        </header>

        <div
          className="onboard-progress"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin="1"
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((number) => (
            <span key={number} className={number <= step ? "done" : ""} />
          ))}
        </div>

        {actionError && (
          <div className="onboard-error" role="alert" data-testid="onboard-error">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {step === 1 && (
          <section className="onboard-step" aria-labelledby="onboarding-title">
            <div className="onboard-title-row">
              <div className="onboard-title-icon onboard-title-icon--blue"><Armchair size={28} /></div>
              <div>
                <h1 id="onboarding-title">Welcome to Roundtable_VO</h1>
                <p>Where your people gather.</p>
              </div>
            </div>
            <div className="onboard-intro">
              Families, teams, faith communities, neighborhoods—your people do not fit in a chat thread.
              They fit around a table. This guided setup saves each step before moving forward.
            </div>
            <div className="onboard-footer">
              <button type="button" className="btn btn-ghost" onClick={skipAll} disabled={busy} data-testid="onboard-skip-btn">
                {busy ? "Saving…" : "Complete later"}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(2)} data-testid="onboard-get-started">
                Get Started
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <form className="onboard-step" autoComplete="off" onSubmit={(event) => { event.preventDefault(); saveProfile(); }}>
            <StepHeading title="Your Look" subtitle="Choose exactly how others will see you at the table." />

            <button
              type="button"
              className="onboard-avatar-button"
              onClick={() => setShowAvatarPicker(true)}
              data-testid="onboard-avatar-edit"
              aria-label="Choose an avatar"
            >
              {avatarUrl ? (
                <img src={avatarSrc(avatarUrl)} alt="Selected avatar" />
              ) : (
                <span className="avatar" style={{ background: color }}>
                  {(name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                </span>
              )}
              <span className="onboard-avatar-edit"><Camera size={13} /></span>
            </button>

            <div className="onboard-field">
              <label htmlFor="onboard-display-name">Display Name</label>
              <input
                id="onboard-display-name"
                name="rt_display_label"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={50}
                required
                // Each onboarding step owns the whole screen and this is its only
                // field — focusing it is the expected behaviour, not a trap.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                spellCheck="false"
                {...NO_CONTACT_AUTOFILL}
                data-testid="onboard-name-input"
              />
              <small>Use the name your group will recognize.</small>
            </div>

            <ColorSelector
              label="Seat Color"
              value={color}
              onChange={setColor}
              testPrefix="onboard-color"
            />

            <StepFooter
              busy={busy}
              onBack={goBack}
              secondaryLabel="Complete later"
              onSecondary={() => setStep(3)}
              primaryLabel="Next"
              primaryType="submit"
              primaryDisabled={name.trim().length < 2}
              primaryTestId="onboard-profile-next"
            />

            {showAvatarPicker && (
              <AvatarPicker
                currentUrl={avatarUrl}
                onSelect={setAvatarUrl}
                onClose={() => setShowAvatarPicker(false)}
              />
            )}
          </form>
        )}

        {step === 3 && (
          <form className="onboard-step" autoComplete="off" onSubmit={(event) => { event.preventDefault(); saveConnectivity(); }}>
            <StepHeading title="Stay Connected" subtitle="Optional alerts without surrendering control of your contact information." />

            <div className="onboard-field">
              <label htmlFor="onboard-phone"><Phone size={12} /> Phone Number</label>
              <input
                id="onboard-phone"
                name="rt_notification_number"
                className="input"
                type="text"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="555 123 4567"
                maxLength={20}
                {...NO_CONTACT_AUTOFILL}
                data-testid="onboard-phone-input"
              />
              <small>Browser contact suggestions are disabled on this field. This number is optional.</small>
            </div>

            {smsConfigured && (
              <ToggleCard
                active={autoSms}
                title="Text me when I miss something"
                description="SMS for pings, messages, prayers, and calls"
                disabled={!phone.trim()}
                onClick={() => setAutoSms((current) => !current)}
                testId="onboard-auto-sms-toggle"
              />
            )}

            {isPushSupported() && (
              <ToggleCard
                active={pushEnabled}
                title={<><Bell size={13} /> Browser push notifications</>}
                description="Alerts even when this tab is closed"
                onClick={enablePush}
                busy={busy}
                testId="onboard-push-toggle"
                activeLabel="Enabled"
                inactiveLabel="Enable"
              />
            )}

            <StepFooter
              busy={busy}
              onBack={goBack}
              secondaryLabel="Complete later"
              onSecondary={() => setStep(4)}
              primaryLabel="Next"
              primaryType="submit"
              primaryTestId="onboard-connect-next"
            />
          </form>
        )}

        {step === 4 && (
          <form className="onboard-step" autoComplete="off" onSubmit={(event) => { event.preventDefault(); createTable(); }}>
            <StepHeading title="Your First Table" subtitle="A table is your group’s shared space. You control its name, color, and live status." />

            <div className="onboard-field">
              <label htmlFor="onboard-table-name">Table Name</label>
              <input
                id="onboard-table-name"
                name="rt_table_label"
                className="input"
                placeholder="Family Circle, Study Group, Project Team…"
                value={tableName}
                onChange={(event) => setTableName(event.target.value)}
                maxLength={60}
                required
                // Each onboarding step owns the whole screen and this is its only
                // field — focusing it is the expected behaviour, not a trap.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                spellCheck="false"
                {...NO_CONTACT_AUTOFILL}
                data-testid="onboard-table-name-input"
              />
            </div>

            <ColorSelector
              label="Table Color"
              value={tableColor}
              onChange={setTableColor}
              testPrefix="onboard-table-color"
            />

            <label className="onboard-checkbox" aria-label="Make this table live">
              <input
                id="onboard-table-active"
                type="checkbox"
                checked={tableActive}
                onChange={(event) => setTableActive(event.target.checked)}
                data-testid="onboard-table-active"
              />
              <span>
                <strong>Make this table live</strong>
                <small>Live tables appear as active gathering spaces.</small>
              </span>
            </label>

            {tableName.trim() && (
              <div className="onboard-table-preview" aria-label="Table preview">
                <div style={{ background: tableColor }}><Armchair size={18} /></div>
                <span>
                  <strong>{tableName.trim()}</strong>
                  <small>{tableActive ? "Live" : "Dormant"}</small>
                </span>
              </div>
            )}

            <StepFooter
              busy={busy}
              onBack={goBack}
              secondaryLabel="Complete later"
              onSecondary={() => setStep(6)}
              primaryLabel="Create Table"
              primaryType="submit"
              primaryDisabled={!tableName.trim()}
              primaryTestId="onboard-create-table-btn"
            />
          </form>
        )}

        {step === 5 && (
          <section className="onboard-step">
            <StepHeading title="Bring Your People" subtitle="Generate one code to share by text, email, or any channel you choose." />

            {!inviteCode ? (
              <button
                type="button"
                className="btn btn-primary onboard-full-button"
                onClick={generateInvite}
                disabled={busy}
                data-testid="onboard-generate-invite"
              >
                <Link2 size={16} /> {busy ? "Generating…" : "Generate Invite Code"}
              </button>
            ) : (
              <div className="onboard-invite-code">
                <span>Your Invite Code</span>
                <div>
                  <strong>{inviteCode}</strong>
                  <button type="button" className="btn btn-secondary" onClick={copyInvite} data-testid="onboard-copy-invite" aria-label="Copy invite code">
                    <Copy size={14} />
                  </button>
                </div>
                <small>This code expires in 30 days.</small>
              </div>
            )}

            <div className="onboard-share-grid">
              <button type="button" className="btn btn-secondary" onClick={() => shareInvite("sms")} disabled={!inviteCode}>
                <MessageSquare size={14} /> Text
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => shareInvite("email")} disabled={!inviteCode}>
                <Mail size={14} /> Email
              </button>
            </div>

            <StepFooter
              busy={busy}
              onBack={goBack}
              secondaryLabel="Complete later"
              onSecondary={() => setStep(6)}
              primaryLabel="Next"
              onPrimary={() => setStep(6)}
              primaryTestId="onboard-invite-next"
              secondaryTestId="onboard-invite-skip"
            />
          </section>
        )}

        {step === 6 && (
          <section className="onboard-step">
            <div className="onboard-title-row">
              <div className="onboard-title-icon onboard-title-icon--green"><Sparkles size={23} /></div>
              <div>
                <h2>You’re all set</h2>
                <p>Review what is ready now. Anything skipped remains available in Settings.</p>
              </div>
            </div>

            <div className="onboard-status-list">
              <StatusRow done={name.trim().length >= 2} label="Profile name" />
              <StatusRow done={Boolean(avatarUrl)} label="Avatar" />
              <StatusRow done={Boolean(phone.trim())} label="Phone number" />
              <StatusRow done={pushEnabled} label="Push notifications" />
              <StatusRow done={Boolean(createdTable)} label="First table" />
            </div>

            <div className="onboard-note">
              Skipped items are optional. The app will not block your work or cover form fields with its own contact-suggestion list.
            </div>

            <div className="onboard-footer onboard-footer--finish">
              <button type="button" className="btn btn-ghost" onClick={goBack} disabled={busy}>
                <ChevronLeft size={14} /> Back
              </button>
              <button type="button" className="btn btn-primary" onClick={finish} disabled={busy} data-testid="onboard-finish-btn">
                {busy ? "Securing account…" : "Start Collaborating"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StepHeading({ title, subtitle }) {
  return (
    <div className="onboard-step-heading">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function ColorSelector({ label, value, onChange, testPrefix }) {
  const selected = normalizeHexColor(value);
  return (
    <fieldset className="onboard-color-fieldset">
      <legend><Palette size={12} /> {label}</legend>
      <div className="onboard-color-grid" role="radiogroup" aria-label={label}>
        {ONBOARDING_COLORS.map((choice) => {
          const isSelected = selected === choice;
          return (
            <button
              key={choice}
              type="button"
              className={`onboard-color-choice${isSelected ? " selected" : ""}`}
              style={{ "--choice-color": choice }}
              onClick={() => onChange(choice)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${choice}${isSelected ? ", selected" : ""}`}
              data-testid={`${testPrefix}-${choice.replace("#", "")}`}
            >
              {isSelected && <Check size={15} />}
            </button>
          );
        })}
        <label className="onboard-custom-color" title="Choose a custom color">
          <input
            type="color"
            value={selected}
            onChange={(event) => onChange(normalizeHexColor(event.target.value, selected))}
            aria-label={`Choose a custom ${label.toLowerCase()}`}
            data-testid={`${testPrefix}-custom`}
          />
          <span>Custom</span>
        </label>
      </div>
      <output className="onboard-color-value" aria-live="polite">Selected: {selected}</output>
    </fieldset>
  );
}

function ToggleCard({
  active,
  title,
  description,
  disabled = false,
  busy = false,
  onClick,
  testId,
  activeLabel = "On",
  inactiveLabel = "Off",
}) {
  return (
    <div className={`onboard-toggle${active ? " active" : ""}`}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        className={`btn ${active ? "btn-secondary" : "btn-primary"}`}
        onClick={onClick}
        disabled={disabled || busy}
        aria-pressed={active}
        data-testid={testId}
      >
        {busy ? "Working…" : active ? activeLabel : inactiveLabel}
      </button>
    </div>
  );
}

function StepFooter({
  busy,
  onBack,
  secondaryLabel,
  onSecondary,
  secondaryTestId,
  primaryLabel,
  onPrimary,
  primaryType = "button",
  primaryDisabled = false,
  primaryTestId,
}) {
  return (
    <div className="onboard-footer onboard-footer--steps">
      <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>
        <ChevronLeft size={14} /> Back
      </button>
      <div className="onboard-footer-actions">
        <button type="button" className="btn btn-ghost" onClick={onSecondary} disabled={busy} data-testid={secondaryTestId}>
          {secondaryLabel}
        </button>
        <button
          type={primaryType}
          className="btn btn-primary"
          onClick={onPrimary}
          disabled={busy || primaryDisabled}
          data-testid={primaryTestId}
        >
          {busy ? "Saving…" : primaryLabel}
        </button>
      </div>
    </div>
  );
}

function StatusRow({ done, label }) {
  return (
    <div className="onboard-status-row">
      <span className={done ? "done" : ""}>{done && <Check size={12} />}</span>
      <strong className={done ? "" : "pending"}>{label}</strong>
    </div>
  );
}
