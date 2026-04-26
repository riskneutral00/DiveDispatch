import type { Language } from '@/lib/types/language'
import {
  languagesFromProfile,
  languagesToPayload,
  INITIAL_CUSTOMER_LANGUAGES,
  INITIAL_TEACHING_LANGUAGES,
} from './languages'

export interface FormBlock<TState extends Record<string, unknown>, TPayload extends Record<string, unknown>> {
  defaults: TState
  fromProfile: (p: Record<string, unknown>) => Partial<TState>
  toPayload: (f: TState) => TPayload
}

export const customerLanguagesBlock: FormBlock<{ customerLanguages: Language[] }, { customerLanguages: string[] }> = {
  defaults: INITIAL_CUSTOMER_LANGUAGES,
  fromProfile: (p) => ({
    customerLanguages: languagesFromProfile(p.customerLanguages as string[] | undefined),
  }),
  toPayload: (f) => ({
    customerLanguages: languagesToPayload(f.customerLanguages),
  }),
}

export const teachingLanguagesBlock: FormBlock<{ teachingLanguages: Language[] }, { teachingLanguages: string[] }> = {
  defaults: INITIAL_TEACHING_LANGUAGES,
  fromProfile: (p) => ({
    teachingLanguages: languagesFromProfile(p.teachingLanguages as string[] | undefined),
  }),
  toPayload: (f) => ({
    teachingLanguages: languagesToPayload(f.teachingLanguages),
  }),
}

export function composeBlocks<TState extends Record<string, unknown>, TPayload extends Record<string, unknown>>(
  blocks: FormBlock<Record<string, unknown>, Record<string, unknown>>[],
): FormBlock<TState, TPayload> {
  const defaults = blocks.reduce<Record<string, unknown>>((acc, b) => ({ ...acc, ...b.defaults }), {})
  return {
    defaults: defaults as TState,
    fromProfile: (p) =>
      blocks.reduce<Record<string, unknown>>((acc, b) => ({ ...acc, ...b.fromProfile(p) }), {}) as Partial<TState>,
    toPayload: (f) =>
      blocks.reduce<Record<string, unknown>>((acc, b) => ({ ...acc, ...b.toPayload(f) }), {}) as TPayload,
  }
}
