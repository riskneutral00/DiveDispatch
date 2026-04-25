import { defineLiteralUnion } from './enumValidator'

const COMPRESSOR_LOCATIONS_DEF = defineLiteralUnion(['fixed', 'boat', 'venue'] as const)
export const COMPRESSOR_LOCATIONS = COMPRESSOR_LOCATIONS_DEF.values
export const compressorLocationValidator = COMPRESSOR_LOCATIONS_DEF.validator
export type CompressorLocation = (typeof COMPRESSOR_LOCATIONS)[number]
