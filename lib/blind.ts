export const BLIND_QUESTIONS: { k: 'q1' | 'q2' | 'q3' | 'q4' | 'q5'; q: string; options: [string, string][] }[] = [
  { k: 'q1', q: 'Would you rather have a luxury vacation or a bigger down payment?', options: [['vacation', 'Luxury vacation'], ['down_payment', 'Bigger down payment'], ['both', 'Honestly, both']] },
  { k: 'q2', q: 'Split the check, alternate, or whoever invites pays?', options: [['split', 'Split it'], ['alternate', 'Alternate'], ['inviter', 'Whoever invites pays']] },
  { k: 'q3', q: 'What purchase would you never give up?', options: [['travel', 'Travel'], ['food', 'Good food'], ['wellness', 'Fitness and wellness'], ['style', 'Style'], ['tech', 'Tech'], ['home', 'My home'], ['car', 'My car']] },
  { k: 'q4', q: 'How much spending needs a conversation with your partner?', options: [['1', 'Over $100'], ['2', 'Over $500'], ['3', 'Over $1,000'], ['4', 'Over $5,000']] },
  { k: 'q5', q: 'Would you date someone who earns less but saves more?', options: [['yes', 'Absolutely'], ['depends', 'Depends'], ['no', 'Probably not']] },
];
export type Answers = Partial<Record<'q1' | 'q2' | 'q3' | 'q4' | 'q5', string>>;
export const answerLabel = (k: string, v?: string) => BLIND_QUESTIONS.find((q) => q.k === k)?.options.find(([o]) => o === v)?.[1] ?? '—';
export type BlindRound = {
  id: string; score: number; created_at: string; revealed: boolean; my_choice: 'connect' | 'pass' | null; matched: boolean; they_passed: boolean;
  conversation_id: string | null; mine: Answers | null; theirs: Answers | null; hint: { age: number; band: string | null };
  other: { id: string; first_name: string | null; neighborhood: string | null; job: string | null } | null;
};
