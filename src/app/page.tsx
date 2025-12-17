import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Play,
  Sparkles,
  ShieldCheck,
  Store,
  ScanSearch,
  Wand2,
  MessageSquareText,
  Mic,
  Zap,
  CheckCircle2,
  ChevronRight,
  Rocket,
  LayoutGrid,
  BadgeCheck,
} from "lucide-react";

/**
 * EFRO Landingpage
 * Route: /
 *
 * IMPORTANT:
 * - No `asChild` usage here to avoid invalid DOM props warnings.
 * - Keep as Server Component (no "use client").
 * - DEMO_VIDEO_URL can be set later (YouTube/Vimeo EMBED URL).
 */

// Example YouTube embed: "https://www.youtube.com/embed/VIDEO_ID"
const DEMO_VIDEO_URL = "";

/* --------------------------- small UI helpers --------------------------- */

type LinkButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
};

function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: LinkButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ring-offset-white";

  const primary =
    "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:from-indigo-700 hover:to-blue-700";
  const outline =
    "border border-slate-200 bg-white/80 text-slate-900 hover:bg-white shadow-sm";
  const ghost =
    "text-slate-700 hover:bg-white/70 border border-transparent";

  const variantClass =
    variant === "outline" ? outline : variant === "ghost" ? ghost : primary;

  return (
    <Link href={href} className={`${base} ${variantClass} ${className}`}>
      {children}
    </Link>
  );
}

function Pill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      <span className="text-indigo-600">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-44 -left-44 h-[560px] w-[560px] rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute -bottom-44 -right-44 h-[560px] w-[560px] rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {/* Top nav */}
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 shadow-lg" />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900">
                EFRO
              </div>
              <div className="text-xs text-slate-500">
                Avatar-Seller für Shopify & Custom Shops
              </div>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-2">
            <LinkButton href="/demo" variant="outline">
              Demo
            </LinkButton>
            <LinkButton href="#early-access" variant="ghost">
              Early Access <ChevronRight size={16} />
            </LinkButton>
            <LinkButton href="/efro/onboarding">
              Installieren <ArrowRight size={18} />
            </LinkButton>
          </nav>
        </header>

        {/* HERO */}
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          <Card className="rounded-2xl shadow-xl">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700">
                  <Sparkles size={14} />
                  Early Access verfügbar
                </div>
                <Pill icon={<Store size={14} />} text="Shopify Embedded App" />
                <Pill icon={<MessageSquareText size={14} />} text="Chat + Empfehlungen" />
                <Pill icon={<Mic size={14} />} text="Voice optional" />
              </div>

              <CardTitle className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                EFRO verkauft in deinem Shop – wie ein Profi.
              </CardTitle>

              <p className="text-lg text-slate-600">
                Avatar + Chat + Voice. EFRO versteht Intent, Budget, Kategorie & Attribute – zeigt passende Produkte sofort
                und hilft dir zusätzlich, deinen Katalog so zu optimieren, dass EFRO (und dein Shop) besser konvertiert.
              </p>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-900">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 text-indigo-700" />
                  <div>
                    <div className="font-extrabold">DSGVO-Hinweis</div>
                    <div className="text-indigo-800/80">
                      EFRO begrüßt Besucher erst nach Klick auf „Start“ (keine Auto-Audio/Auto-Tracking).
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton
                  href="/avatar-seller?shop=demo"
                  className="hover:scale-[1.01] transition-transform"
                >
                  Live Demo starten <Play size={18} />
                </LinkButton>

                <LinkButton href="#video" variant="outline">
                  Video ansehen
                </LinkButton>

                <LinkButton href="#early-access" variant="outline">
                  Early Access
                </LinkButton>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FeatureMini
                  icon={<MessageSquareText size={18} />}
                  title="Verkäufer-Dialog"
                  desc="Klar, schnell, verkaufsstark – wie ein Profi."
                />
                <FeatureMini
                  icon={<Zap size={18} />}
                  title="Sofort Empfehlungen"
                  desc="Produkte im Panel – passend zu Intent & Budget."
                />
                <FeatureMini
                  icon={<Mic size={18} />}
                  title="Voice optional"
                  desc="Natürliche Stimme (z. B. ElevenLabs)."
                />
                <FeatureMini
                  icon={<Wand2 size={18} />}
                  title="Katalog-Optimierung"
                  desc="Titel/Tags/Beschreibungen verbessern lassen."
                />
              </div>

              <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <BadgeCheck size={18} className="mt-0.5 text-indigo-600" />
                  <div className="text-sm text-slate-700">
                    <span className="font-extrabold text-slate-900">Zielbild:</span>{" "}
                    Shopify zuerst – danach als Widget/Script auch für selbstgebaute Shops.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* VIDEO / DEMO STORY (compact when no video) */}
          <Card id="video" className="rounded-2xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-slate-900">
                Sieh EFRO live im Demo-Shop
              </CardTitle>
              <p className="text-slate-600">
                Kurzes Video: Ich stelle Fragen im Demo-Shopify-Shop – EFRO antwortet, empfiehlt Produkte und zeigt den Flow.
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                {DEMO_VIDEO_URL ? (
                  <div className="aspect-video w-full">
                    <iframe
                      className="h-full w-full"
                      src={DEMO_VIDEO_URL}
                      title="EFRO Demo Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
                        <Play size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="font-extrabold text-slate-900">
                          Video kommt als nächstes
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          Sobald du ein Video hast, setzt du oben in dieser Datei{" "}
                          <span className="font-mono">DEMO_VIDEO_URL</span> (YouTube/Vimeo Embed) – dann wird es automatisch angezeigt.
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                          <MiniChecklistItem text="Fragen stellen (Budget/Kategorie/Intent)" />
                          <MiniChecklistItem text="EFRO empfiehlt Produkte im Panel" />
                          <MiniChecklistItem text="DSGVO: Start-Klick → danach Voice/Chat" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <LinkButton href="/demo">
                  Demo-Seite öffnen <ArrowRight size={18} />
                </LinkButton>
                <LinkButton href="/efro/onboarding" variant="outline">
                  Installations-Flow ansehen
                </LinkButton>
              </div>

              <div className="rounded-2xl border bg-white/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Rocket size={18} className="mt-0.5 text-indigo-600" />
                  <div className="text-sm text-slate-700">
                    EFRO soll sich <span className="font-extrabold text-slate-900">selbst verkaufen</span>:
                    Besucher klickt „Start“ → EFRO begrüßt, fragt nach Wunsch/Budget, zeigt Produkte, pusht Abschluss.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2 text-slate-900">
            <LayoutGrid size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-extrabold">So läuft die Installation ab</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StepCard
              icon={<Store size={18} />}
              title="1) Installieren (Shopify Embedded App)"
              desc="Du installierst EFRO im Shopify Admin. (Später mit OAuth + Billing)."
            />
            <StepCard
              icon={<ScanSearch size={18} />}
              title="2) Katalog scannen"
              desc="EFRO liest Produkte/Collections und baut eine robuste Datenbasis für Empfehlungen auf."
            />
            <StepCard
              icon={<Wand2 size={18} />}
              title="3) Optimierungsvorschläge"
              desc="EFRO zeigt konkrete Vorschläge: Titel, Tags, Beschreibungen – damit Suche & Empfehlungen besser performen."
            />
          </div>

          <div className="mt-4 rounded-2xl border bg-white/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 text-indigo-700" />
              <div className="text-sm text-slate-700">
                <span className="font-extrabold text-slate-900">Wichtig:</span>{" "}
                Besucher werden im Shop begrüßt, aber aus DSGVO-Gründen startet Voice/Interaktion erst nach Klick auf „Start“.
                Danach läuft die Konversation wie bei einem echten Verkäufer.
              </div>
            </div>
          </div>
        </section>

        {/* SALES FLOW */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2 text-slate-900">
            <MessageSquareText size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-extrabold">So verkauft EFRO im Shop</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FlowCard
              step="1"
              title="Frage verstehen"
              desc='Kunde schreibt normal: „unter 300€“, „für Geschenk“, „Premium“. EFRO erkennt Intent, Budget & Kategorie.'
            />
            <FlowCard
              step="2"
              title="Produkte wählen"
              desc="EFRO filtert den Katalog, sortiert nach Passung und zeigt sofort passende Produkte im Panel."
            />
            <FlowCard
              step="3"
              title="Abschluss pushen"
              desc='Kurze, klare Empfehlung + Alternativen. Optional Upsell/Cross-Sell („passt dazu“).'
            />
          </div>
        </section>

        {/* EARLY ACCESS */}
        <section id="early-access" className="mt-12">
          <div className="mb-4 flex items-center gap-2 text-slate-900">
            <Sparkles size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-extrabold">Early Access</h2>
          </div>

          <p className="mb-5 text-slate-600">
            Early Access ist günstiger und hilft dir, EFRO früh in deinem Shop zu testen.
            Später sind die regulären Preise höher (Ziel: 299€/699€/999€).
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PricingCard
              price="49€"
              title="Starter (Early)"
              bullets={[
                "Avatar + Chat Grundflow",
                "Basis Empfehlungen (Intent/Budget/Kategorie)",
                "Demo-Shop & Onboarding",
              ]}
            />
            <PricingCard
              price="149€"
              title="Pro (Early)"
              bullets={[
                "Alles aus Starter",
                "Voice (optional)",
                "Mehr Log-Einblicke (Operator-Sicht)",
              ]}
              highlight
            />
            <PricingCard
              price="299€"
              title="Enterprise (Early)"
              bullets={[
                "Alles aus Pro",
                "Katalog-Optimierung (Titel/Tags/Beschreibung) priorisiert",
                "Priorisierte Betreuung/Feedback-Loop",
              ]}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/efro/onboarding">
              Early Access starten <ArrowRight size={18} />
            </LinkButton>
            <LinkButton href="/demo" variant="outline">
              Erst Demo testen
            </LinkButton>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2 text-slate-900">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-extrabold">FAQ</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <FaqItem
              q="Warum muss der Gast auf „Start“ klicken?"
              a="DSGVO-freundlich: keine automatische Audio-Wiedergabe / Interaktion ohne Einwilligung. Danach kann EFRO normal sprechen & verkaufen."
            />
            <FaqItem
              q="Was passiert während der Installation?"
              a="EFRO wird als Shopify Embedded App installiert, scannt Produkte/Collections und baut daraus eine robuste Empfehlungsgrundlage."
            />
            <FaqItem
              q="Welche Optimierungen schlägt EFRO vor?"
              a="Konkrete Vorschläge für bessere Produkttitel, Tags/Keywords und Beschreibungen – damit Suche & Empfehlungen im Shop besser funktionieren."
            />
            <FaqItem
              q="Funktioniert EFRO später auch in Custom Shops?"
              a="Ja. Ziel ist: Shopify zuerst – danach Einbettung auch auf selbstgebauten Shops (Widget/Script-Integration)."
            />
          </div>
        </section>

        {/* FOOTER CTA */}
        <footer className="mt-14 rounded-2xl border bg-white/70 p-6 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-xl font-extrabold text-slate-900">
                Bereit für einen Profi-Seller im Shop?
              </div>
              <div className="text-slate-600">
                Erst Demo testen – dann installieren. EFRO verkauft, du skalierst.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <LinkButton href="/demo" variant="outline">
                Demo öffnen
              </LinkButton>
              <LinkButton href="/efro/onboarding">
                Installieren <ArrowRight size={18} />
              </LinkButton>
            </div>
          </div>

          <div className="mt-5 text-xs text-slate-500">
            © {new Date().getFullYear()} EFRO • app.avatarsalespro.com
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ------------------------------- components ------------------------------- */

function FeatureMini({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        {icon}
      </div>
      <div>
        <div className="font-extrabold text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{desc}</div>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="rounded-2xl bg-white/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg">
          {icon}
        </div>
        <CardTitle className="text-lg font-extrabold text-slate-900">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">{desc}</CardContent>
    </Card>
  );
}

function FlowCard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <Card className="rounded-2xl bg-white/70 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-extrabold">
            {step}
          </div>
          <CardTitle className="text-lg font-extrabold text-slate-900">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">{desc}</CardContent>
    </Card>
  );
}

function PricingCard({
  price,
  title,
  bullets,
  highlight,
}: {
  price: string;
  title: string;
  bullets: string[];
  highlight?: boolean;
}) {
  return (
    <Card
      className={`rounded-2xl bg-white/70 shadow-sm ${
        highlight ? "border-indigo-300 shadow-md" : ""
      }`}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg font-extrabold text-slate-900">
          {title}
        </CardTitle>
        <div className="text-3xl font-extrabold text-slate-900">{price}</div>
        <div className="text-sm text-slate-500">pro Monat (Early Access)</div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-slate-700">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-indigo-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <LinkButton
          href="/efro/onboarding"
          variant={highlight ? "primary" : "outline"}
          className="w-full"
        >
          Starten <ArrowRight size={18} />
        </LinkButton>
      </CardContent>
    </Card>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border bg-white/70 p-4 shadow-sm">
      <summary className="cursor-pointer list-none font-extrabold text-slate-900">
        {q}
      </summary>
      <div className="mt-2 text-sm text-slate-600">{a}</div>
    </details>
  );
}

function MiniChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border bg-white/70 p-3 shadow-sm">
      <CheckCircle2 size={16} className="mt-0.5 text-indigo-600" />
      <div className="text-sm text-slate-700">{text}</div>
    </div>
  );
}
