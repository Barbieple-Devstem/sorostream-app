"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DurationPicker from "@/components/DurationPicker";
import FlowRatePreview from "@/components/FlowRatePreview";
import StreamTemplatePicker from "@/components/StreamTemplatePicker";
import RecipientAutocomplete from "@/components/RecipientAutocomplete";
import TransactionStepper, { TxStage } from "@/components/TransactionStepper";
import { SkeletonForm } from "@/components/Skeleton";
import { useTranslations } from "@/src/lib/i18n";
import { trackEvent } from "@/src/lib/analytics";
import { sorostream, getCollateralConfig, checkIsNewSender, calcCollateral, getGasFeeEstimate, type GasFeeEstimate } from "@/src/lib/sorostream";
import { useWallet } from "@/src/context/WalletContext";

type Step = "recipient" | "amount" | "review";

const SUPPORTED_TOKENS = [
  { symbol: "USDC", name: "USD Coin",        address: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU" },
  { symbol: "XLM",  name: "Stellar Lumens",  address: "native" },
  { symbol: "AQUA", name: "Aquarius",        address: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA" },
  { symbol: "yXLM", name: "Yield XLM",       address: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55" },
] as const;

const CUSTOM_TOKEN_VALUE = "__custom__";

function validateRecipient(value: string): string {
  if (!value) return "Recipient address is required.";
  if (!/^G[A-Z2-7]{55}$/.test(value))
    return "Must be a valid Stellar public key (starts with G, 56 chars).";
  return "";
}

function validateAmount(value: string): string {
  if (!value) return "Amount is required.";
  if (!/^\d*\.?\d*$/.test(value.trim())) return "Amount must contain only numbers.";
  if (Number(value) <= 0) return "Amount must be greater than 0.";
  return "";
}

function validateDuration(seconds: number): string {
  if (seconds <= 0) return "Duration must be greater than 0.";
  return "";
}

/**
 * Validates an optional end-date ISO string.
 * Returns an error if the value is provided but points to the past.
 */
function validateEndDate(value: string): string {
  if (!value) return "";
  const ts = new Date(value).getTime();
  if (isNaN(ts)) return "Invalid date.";
  if (ts <= Date.now()) return "End date must be in the future.";
  return "";
}

/**
 * Validates an optional cliff-date ISO string relative to the end date.
 * Returns an error if the cliff is after the end date.
 */
function validateCliffDate(cliffValue: string, endValue: string): string {
  if (!cliffValue) return "";
  const cliffTs = new Date(cliffValue).getTime();
  if (isNaN(cliffTs)) return "Invalid cliff date.";
  if (cliffTs <= Date.now()) return "Cliff date must be in the future.";
  if (endValue) {
    const endTs = new Date(endValue).getTime();
    if (!isNaN(endTs) && cliffTs >= endTs) {
      return "Cliff date must be before the end date.";
    }
  }
  return "";
}

const stepLabels: Record<Step, { title: string; number: number }> = {
  recipient: { title: "Recipient", number: 1 },
  amount: { title: "Amount & Duration", number: 2 },
  review: { title: "Review & Confirm", number: 3 },
};

const STEPS: Step[] = ["recipient", "amount", "review"];

function NewStreamWizard() {
  const router = useRouter();
  const t = useTranslations("stream_new");
  const [step, setStep] = useState<Step>("recipient");
  const searchParams = useSearchParams();
  const { address } = useWallet();

  const recipientParam = searchParams.get("recipient");
  const amountParam = searchParams.get("amount");
  const durationParam = searchParams.get("duration");

  const initialRecipient =
    recipientParam && /^G[A-Z2-7]{55}$/.test(recipientParam)
      ? recipientParam
      : "";
  const initialAmount = (() => {
    if (!amountParam) return "";
    const num = parseFloat(amountParam);
    return !isNaN(num) && num > 0 ? amountParam : "";
  })();
  const initialDuration = (() => {
    if (!durationParam) return 0;
    const num = parseFloat(durationParam);
    return !isNaN(num) && num > 0 ? Math.round(num) : 0;
  })();

  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState(initialAmount);
  const [duration, setDuration] = useState(initialDuration);
  const [selectedToken, setSelectedToken] = useState<string>(SUPPORTED_TOKENS[0].symbol);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [customTokenError, setCustomTokenError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ recipient: "", amount: "", duration: "", endDate: "", cliffDate: "" });
  const [touched, setTouched] = useState({ recipient: false, amount: false });
  const [durationPickerKey, setDurationPickerKey] = useState(0);

  // Optional end date & cliff date (ISO datetime-local value)
  const [endDate, setEndDate] = useState("");
  const [cliffDate, setCliffDate] = useState("");

  // Transaction progress
  const [txStage, setTxStage] = useState<TxStage | null>(null);
  const [txFailedStage, setTxFailedStage] = useState<TxStage | undefined>(undefined);
  const [txError, setTxError] = useState<string | undefined>(undefined);

  // Auto-renewal settings
  const [autoRenew, setAutoRenew] = useState(false);
  const [autoRenewDuration, setAutoRenewDuration] = useState(0); // 0 = same as stream duration
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Gas fee estimate
  const [gasFee, setGasFee] = useState<GasFeeEstimate | null>(null);
  const [gasFeeLoading, setGasFeeLoading] = useState(false);
  const [gasFeeStale, setGasFeeStale] = useState(false);
  const gasFeeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced gas fee re-fetch whenever amount changes on the amount step
  useEffect(() => {
    if (step !== "amount") return;
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setGasFee(null);
      return;
    }
    if (gasFeeDebounceRef.current) clearTimeout(gasFeeDebounceRef.current);
    gasFeeDebounceRef.current = setTimeout(async () => {
      setGasFeeLoading(true);
      setGasFeeStale(false);
      try {
        const estimate = await getGasFeeEstimate(Math.round(parsed * 10_000_000));
        setGasFee(estimate);
      } catch {
        setGasFeeStale(true); // keep last known value, mark stale
      } finally {
        setGasFeeLoading(false);
      }
    }, 500);
    return () => {
      if (gasFeeDebounceRef.current) clearTimeout(gasFeeDebounceRef.current);
    };
  }, [amount, step]);

  // Collateral requirement
  const [collateralBps, setCollateralBps] = useState<number | null>(null);
  const [isNewSender, setIsNewSender] = useState(false);

  // Fetch collateral config and new-sender status once when reaching review step
  useEffect(() => {
    if (step !== "review") return;
    let cancelled = false;
    async function fetchCollateral() {
      const [config, newSender] = await Promise.all([
        getCollateralConfig(),
        checkIsNewSender(address ?? ""),
      ]);
      if (!cancelled) {
        setCollateralBps(config.basisPoints);
        setIsNewSender(newSender);
      }
    }
    void fetchCollateral();
    return () => { cancelled = true; };
  }, [step, address]);

  function handleTemplateSelect(seconds: number, suggestedAmount?: string, recipientOverride?: string) {
    setDuration(seconds);
    setErrors((prev) => ({ ...prev, duration: "" }));
    if (suggestedAmount) {
      setAmount(suggestedAmount);
      setErrors((prev) => ({ ...prev, amount: "" }));
    }
    if (recipientOverride && /^G[A-Z2-7]{55}$/.test(recipientOverride)) {
      setRecipient(recipientOverride);
      setErrors((prev) => ({ ...prev, recipient: "" }));
    }
  }

  function handleRecipientBlur() {
    setTouched((prev) => ({ ...prev, recipient: true }));
    setErrors((prev) => ({ ...prev, recipient: validateRecipient(recipient) }));
  }

  function handleAmountBlur() {
    setTouched((prev) => ({ ...prev, amount: true }));
    setErrors((prev) => ({ ...prev, amount: validateAmount(amount) }));
  }

  function goNext() {
    if (step === "recipient") {
      const err = validateRecipient(recipient);
      if (err) {
        setErrors((prev) => ({ ...prev, recipient: err }));
        setTouched((prev) => ({ ...prev, recipient: true }));
        return;
      }
      setStep("amount");
    } else if (step === "amount") {
      const aErr = validateAmount(amount);
      const dErr = validateDuration(duration);
      const eErr = validateEndDate(endDate);
      const cErr = validateCliffDate(cliffDate, endDate);
      if (aErr || dErr || eErr || cErr) {
        setErrors({ ...errors, amount: aErr, duration: dErr, endDate: eErr, cliffDate: cErr });
        return;
      }
      setStep("review");
    }
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  function resolvedTokenAddress(): string | null {
    if (selectedToken === CUSTOM_TOKEN_VALUE) {
      const trimmed = customTokenAddress.trim();
      if (!trimmed) { setCustomTokenError("Contract address is required."); return null; }
      setCustomTokenError("");
      return trimmed;
    }
    return SUPPORTED_TOKENS.find((t) => t.symbol === selectedToken)?.address ?? SUPPORTED_TOKENS[0].address;
  }

  async function handleCreateStream() {
    const rErr = validateRecipient(recipient);
    const aErr = validateAmount(amount);
    const dErr = validateDuration(duration);
    const eErr = validateEndDate(endDate);
    const cErr = validateCliffDate(cliffDate, endDate);
    if (rErr || aErr || dErr || eErr || cErr) {
      setErrors({ recipient: rErr, amount: aErr, duration: dErr, endDate: eErr, cliffDate: cErr });
      return;
    }

    const tokenAddress = resolvedTokenAddress();
    if (!tokenAddress) return;

    setLoading(true);
    setTxStage(TxStage.Building);
    setTxFailedStage(undefined);
    setTxError(undefined);
    trackEvent({ type: "stream_create_start" });

    try {
      // Building phase — construct the tx envelope
      await new Promise((r) => setTimeout(r, 400));
      setTxStage(TxStage.Signing);

      // Signing phase — wait for wallet
      await new Promise((r) => setTimeout(r, 400));
      setTxStage(TxStage.Submitting);

      // Submitting phase — broadcast
      await new Promise((r) => setTimeout(r, 300));
      setTxStage(TxStage.Confirming);

      // Confirming phase — actual SDK call
      const result = await sorostream.createStream({
        recipient,
        amount,
        durationSeconds: duration,
        token: selectedToken === CUSTOM_TOKEN_VALUE ? tokenAddress : selectedToken,
        autoRenew,
        autoRenewDurationSeconds: autoRenew && autoRenewDuration > 0 ? autoRenewDuration : undefined,
      });

      setTxStage(TxStage.Done);
      trackEvent({ type: "stream_create_complete", streamId: result.streamId });

      // Auto-close after 2 seconds, then redirect
      await new Promise((r) => setTimeout(r, 2000));

      setRecipient("");
      setAmount("");
      setDuration(0);
      setEndDate("");
      setCliffDate("");
      setAutoRenew(false);
      setAutoRenewDuration(0);
      setShowAdvanced(false);
      setGasFee(null);
      setErrors({ recipient: "", amount: "", duration: "", endDate: "", cliffDate: "" });
      setTouched({ recipient: false, amount: false });
      setDurationPickerKey((k) => k + 1);
      setTxStage(null);
      router.push(`/stream/${result.streamId}?new=true`);
    } catch (err) {
      console.error("Failed to create stream:", err);
      setTxFailedStage(txStage ?? TxStage.Confirming);
      setTxError(err instanceof Error ? err.message : "Transaction failed. Please try again.");
      setTxStage(txStage ?? TxStage.Confirming);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-8">{t("title")}</h1>
          {txStage !== null ? (
            <div className="bg-gray-800 rounded-xl p-8 space-y-6" aria-label="Transaction in progress">
              <h2 className="text-lg font-semibold text-center">
                {txStage === TxStage.Done ? "🎉 Stream Created!" : "Creating your stream…"}
              </h2>
              <TransactionStepper
                currentStage={txStage}
                failedStage={txFailedStage}
                errorMessage={txError}
              />
              {txFailedStage && (
                <button
                  type="button"
                  onClick={() => { setLoading(false); setTxStage(null); setTxFailedStage(undefined); setTxError(undefined); }}
                  className="w-full border border-gray-600 text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Back to Form
                </button>
              )}
            </div>
          ) : (
            <SkeletonForm />
          )}
        </div>
      </main>
    );
  }

  const canGoNext = step === "recipient"
    ? recipient.length > 0
    : step === "amount"
    ? amount.length > 0 && duration > 0
    : true;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                    step === s
                      ? "bg-green-700 text-white"
                      : STEPS.indexOf(step) > i
                      ? "bg-green-800 text-green-300"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {STEPS.indexOf(step) > i ? "✓" : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${step === s ? "text-white" : "text-gray-400"}`}>
                  {stepLabels[s].title}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px ${STEPS.indexOf(step) > i ? "bg-green-600" : "bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-center">{stepLabels[step].title}</h1>
        </div>

        {/* Step: Recipient */}
        {step === "recipient" && (
          <div className="space-y-6">
            <div>
              <label htmlFor="recipient" className="text-gray-200 text-sm font-medium block mb-2">
                {t("recipient_label")}
              </label>
              <RecipientAutocomplete
                value={recipient}
                onChange={(v) => {
                  setRecipient(v);
                  setErrors((prev) => ({ ...prev, recipient: "" }));
                }}
                onBlur={handleRecipientBlur}
                placeholder={t("recipient_placeholder")}
                error={errors.recipient}
                touched={touched.recipient}
              />
              {errors.recipient && (
                <p id="recipient-error" className="text-red-400 text-sm mt-1">
                  {errors.recipient}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Amount & Duration */}
        {step === "amount" && (
          <div className="space-y-6">
            {/* Token selector */}
            <div>
              <label htmlFor="token-select" className="text-gray-200 text-sm font-medium block mb-2">
                Token
              </label>
              <select
                id="token-select"
                value={selectedToken}
                onChange={(e) => {
                  setSelectedToken(e.target.value);
                  setCustomTokenError("");
                }}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} — {t.name} ({t.address === "native" ? "native" : `${t.address.slice(0, 6)}…${t.address.slice(-4)}`})
                  </option>
                ))}
                <option value={CUSTOM_TOKEN_VALUE}>Custom token…</option>
              </select>
              {selectedToken === CUSTOM_TOKEN_VALUE && (
                <div className="mt-2">
                  <input
                    id="custom-token-address"
                    type="text"
                    value={customTokenAddress}
                    onChange={(e) => { setCustomTokenAddress(e.target.value); setCustomTokenError(""); }}
                    placeholder="Contract address (e.g. C…)"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                    aria-label="Custom token contract address"
                    aria-invalid={!!customTokenError}
                    aria-describedby={customTokenError ? "custom-token-error" : undefined}
                  />
                  {customTokenError && (
                    <p id="custom-token-error" className="text-red-400 text-xs mt-1">{customTokenError}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="amount" className="text-gray-200 text-sm font-medium block mb-2">
                {t("amount_label")}
              </label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                  if (touched.amount) {
                    setErrors((prev) => ({ ...prev, amount: validateAmount(val) }));
                  } else {
                    setErrors((prev) => ({ ...prev, amount: "" }));
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (!/^\d*\.?\d*$/.test(pasted.trim())) {
                    e.preventDefault();
                    setTouched((prev) => ({ ...prev, amount: true }));
                    setErrors((prev) => ({ ...prev, amount: "Amount must contain only numbers." }));
                  }
                }}
                onBlur={handleAmountBlur}
                placeholder={t("amount_placeholder")}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                aria-required="true"
                aria-invalid={!!(touched.amount && errors.amount)}
                aria-describedby={
                  touched.amount && errors.amount ? "amount-error" : undefined
                }
              />
              {errors.amount && (
                <p id="amount-error" className="text-red-400 text-sm mt-1">
                  {errors.amount}
                </p>
              )}
            </div>

            <StreamTemplatePicker
              onSelect={handleTemplateSelect}
              currentRecipient={recipient}
              currentAmount={amount}
              currentDuration={duration}
            />

            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">{t("duration_label")}</label>
              <DurationPicker
                key={durationPickerKey}
                initialSeconds={duration > 0 ? duration : undefined}
                onChange={(s) => {
                  setDuration(s);
                  if (s > 0) setErrors((prev) => ({ ...prev, duration: "" }));
                }}
                error={errors.duration || undefined}
              />
            </div>

            {/* Optional end date */}
            <div>
              <label htmlFor="end-date" className="text-gray-200 text-sm font-medium block mb-2">
                End Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setErrors((prev) => ({ ...prev, endDate: validateEndDate(e.target.value) }));
                }}
                onBlur={() => setErrors((prev) => ({ ...prev, endDate: validateEndDate(endDate) }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                aria-invalid={!!errors.endDate}
                aria-describedby={errors.endDate ? "end-date-error" : undefined}
              />
              {errors.endDate && (
                <p id="end-date-error" role="alert" className="text-red-400 text-sm mt-1">
                  {errors.endDate}
                </p>
              )}
            </div>

            {/* Optional cliff date */}
            <div>
              <label htmlFor="cliff-date" className="text-gray-200 text-sm font-medium block mb-2">
                Cliff Date <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="cliff-date"
                type="datetime-local"
                value={cliffDate}
                onChange={(e) => {
                  setCliffDate(e.target.value);
                  setErrors((prev) => ({ ...prev, cliffDate: validateCliffDate(e.target.value, endDate) }));
                }}
                onBlur={() => setErrors((prev) => ({ ...prev, cliffDate: validateCliffDate(cliffDate, endDate) }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                aria-invalid={!!errors.cliffDate}
                aria-describedby={errors.cliffDate ? "cliff-date-error" : undefined}
              />
              {errors.cliffDate && (
                <p id="cliff-date-error" role="alert" className="text-red-400 text-sm mt-1">
                  {errors.cliffDate}
                </p>
              )}
            </div>

            {amount && duration > 0 && (
              <FlowRatePreview amount={amount} durationSeconds={duration} />
            )}

            {/* Gas fee estimate */}
            {(gasFee || gasFeeLoading) && (
              <div
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${
                  gasFeeStale
                    ? "bg-yellow-900/20 border-yellow-700/40 text-yellow-300"
                    : "bg-gray-800 border-gray-700 text-gray-400"
                }`}
                aria-live="polite"
                aria-label="Estimated network fee"
              >
                <span>Estimated network fee</span>
                <span className="flex items-center gap-1.5 font-mono">
                  {gasFeeLoading ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span className="text-gray-500">Refreshing…</span>
                    </>
                  ) : (
                    <>
                      {gasFee && <span className={gasFeeStale ? "text-yellow-300" : "text-white"}>{gasFee.feeFormatted} XLM</span>}
                      {gasFeeStale && <span className="text-yellow-400" title="Could not refresh — showing last known estimate">⚠ stale</span>}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Advanced settings */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Advanced settings
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pl-1">
                  {/* Auto-renewal toggle */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label htmlFor="auto-renew-toggle" className="text-sm text-gray-200 font-medium">
                          Auto-Renewal
                        </label>
                        {/* Tooltip */}
                        <div className="relative group">
                          <button
                            type="button"
                            aria-label="How does auto-renewal work?"
                            className="text-gray-500 hover:text-gray-300 text-xs border border-gray-600 rounded-full w-4 h-4 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                          >
                            ?
                          </button>
                          <div
                            role="tooltip"
                            className="hidden group-hover:block group-focus-within:block absolute left-0 bottom-6 w-64 bg-gray-700 border border-gray-600 rounded-lg p-3 text-xs text-gray-300 leading-relaxed z-10 shadow-lg"
                          >
                            When enabled, the stream automatically restarts at expiry using
                            the same amount. The renewal re-locks the same deposit from your
                            balance — ensure you have sufficient funds each cycle.
                            You can cancel auto-renewal at any time before the next cycle starts.
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Automatically restart the stream when it expires
                      </p>
                    </div>
                    <button
                      id="auto-renew-toggle"
                      type="button"
                      role="switch"
                      aria-checked={autoRenew}
                      onClick={() => setAutoRenew((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex-shrink-0 ${
                        autoRenew ? "bg-green-600" : "bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          autoRenew ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto-renew duration (only when toggle is on) */}
                  {autoRenew && (
                    <div>
                      <label className="text-sm text-gray-200 font-medium block mb-2">
                        Auto-Renew Duration{" "}
                        <span className="text-gray-400 font-normal">(optional — defaults to stream duration)</span>
                      </label>
                      <DurationPicker
                        initialSeconds={autoRenewDuration > 0 ? autoRenewDuration : undefined}
                        onChange={setAutoRenewDuration}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Review & Confirm */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-5 space-y-4 border border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Recipient</span>
                <span className="text-white font-mono text-sm">{recipient}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Token</span>
                <span className="text-white font-mono text-sm">
                  {selectedToken === CUSTOM_TOKEN_VALUE
                    ? `Custom (${customTokenAddress.slice(0, 8)}…)`
                    : selectedToken}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Amount</span>
                <span className="text-white font-mono text-sm">
                  {amount} {selectedToken === CUSTOM_TOKEN_VALUE ? "tokens" : selectedToken}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Duration</span>
                <span className="text-white font-mono text-sm">
                  {(() => {
                    if (duration >= 86400) {
                      const totalDays = duration / 86400;
                      const isWhole = totalDays === Math.floor(totalDays);
                      const dayPart = isWhole ? `${Math.floor(totalDays)}d` : `${totalDays.toFixed(1)}d`;
                      const hourRemainder = Math.floor((duration % 86400) / 3600);
                      return hourRemainder > 0 ? `${dayPart} ${hourRemainder}h` : dayPart;
                    }
                    if (duration >= 3600) {
                      return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
                    }
                    return `${Math.floor(duration / 60)}m`;
                  })()}
                </span>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <FlowRatePreview amount={amount} durationSeconds={duration} />
              </div>
              {autoRenew && (
                <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                  <span className="text-gray-400 text-sm">Auto-Renewal</span>
                  <span className="text-green-400 text-sm font-medium">
                    ✓ Enabled
                    {autoRenewDuration > 0 && (
                      <span className="text-gray-400 font-normal ml-1">
                        ({(() => {
                          const s = autoRenewDuration;
                          if (s >= 86400) return `${Math.floor(s / 86400)}d`;
                          if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
                          return `${Math.floor(s / 60)}m`;
                        })()})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {gasFee && (
                <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                  <span className="text-gray-400 text-sm">Est. network fee</span>
                  <span className="text-gray-300 font-mono text-sm">{gasFee.feeFormatted} XLM</span>
                </div>
              )}
            </div>

            {/* Collateral Required section — shown when sender is subject to the requirement */}
            {isNewSender && collateralBps !== null && collateralBps > 0 && (() => {
              const depositStroops = Math.round(parseFloat(amount || "0") * 10_000_000);
              const collateralStroops = calcCollateral(depositStroops, collateralBps);
              const totalStroops = depositStroops + collateralStroops;
              const collateralAmt = (collateralStroops / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 7 });
              const totalAmt = (totalStroops / 10_000_000).toLocaleString(undefined, { minimumFractionDigits: 7 });
              const token = selectedToken === CUSTOM_TOKEN_VALUE ? "tokens" : selectedToken;
              const pct = (collateralBps / 100).toFixed(2);
              return (
                <div
                  role="note"
                  aria-label="Collateral requirement"
                  className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-base" aria-hidden="true">⚠</span>
                    <p className="text-yellow-300 text-sm font-semibold">Collateral Required</p>
                    <div className="relative group ml-auto">
                      <button
                        type="button"
                        aria-label="When is collateral returned?"
                        className="text-gray-400 hover:text-gray-200 text-xs border border-gray-600 rounded-full w-5 h-5 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                      >
                        ?
                      </button>
                      <div
                        role="tooltip"
                        className="hidden group-hover:block group-focus-within:block absolute right-0 bottom-7 w-64 bg-gray-700 border border-gray-600 rounded-lg p-3 text-xs text-gray-300 leading-relaxed z-10 shadow-lg"
                      >
                        The protocol holds collateral from first-time senders to ensure
                        the stream can be fulfilled. Your collateral is automatically
                        returned to your wallet when the stream ends or is cancelled,
                        provided no dispute is raised.
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs">
                    As a new sender, the protocol requires {pct}% collateral to be locked for the duration of the stream.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stream amount</span>
                      <span className="text-white font-mono">{amount} {token}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Collateral ({pct}%)</span>
                      <span className="text-yellow-300 font-mono">{collateralAmt} {token}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-700 pt-2">
                      <span className="text-gray-300 font-medium">Total required</span>
                      <span className="text-white font-mono font-semibold">{totalAmt} {token}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
          {step !== "recipient" && (
            <button
              type="button"
              onClick={goBack}
              disabled={loading}
              className="flex-1 border border-gray-600 text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              Back
            </button>
          )}
          {step !== "review" ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="flex-1 bg-green-700 text-white py-3 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateStream}
              disabled={loading}
              className="flex-1 bg-green-700 text-white py-3 rounded-lg font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {t("submit")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewStreamPage() {
  return (
    <Suspense fallback={<main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-900 text-white p-4 sm:p-8"><div className="max-w-lg mx-auto"><SkeletonForm /></div></main>}>
      <NewStreamWizard />
    </Suspense>
  );
}
