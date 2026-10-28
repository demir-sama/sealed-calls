import { SealDesk } from "@/components/SealDesk";
export const metadata = { title: "Seal a call", description: "Write a prediction into Walrus Memory with a Sui timestamp and a rule anyone can check." };
export default function SealPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-12">
      <div className="mb-10 max-w-3xl">
        <div className="eyebrow mb-3">The seal desk</div>
        <h1 className="display text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold">Put it on the <em className="text-wax-hi">record.</em></h1>
        <p className="mt-4 text-lg text-dim">Anyone’s prediction — a pundit’s, a friend’s, a model’s, yours. Give it a rule a stranger could check and a date. We seal it before the outcome exists.</p>
      </div>
      <SealDesk />
    </div>
  );
}
