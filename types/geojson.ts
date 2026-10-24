import { z } from "zod";

// Minimal GeoJSON schemas (EPSG:4326, positions are [longitude, latitude]).

export const positionSchema = z.tuple([z.number(), z.number()]);
export type Position = z.infer<typeof positionSchema>;

export const pointSchema = z.object({
  type: z.literal("Point"),
  coordinates: positionSchema,
});

export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(positionSchema)),
});

export const multiPolygonSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(positionSchema))),
});

export type PointGeometry = z.infer<typeof pointSchema>;
export type PolygonGeometry = z.infer<typeof polygonSchema>;
export type MultiPolygonGeometry = z.infer<typeof multiPolygonSchema>;

export function featureSchema<G extends z.ZodType, P extends z.ZodType>(
  geometry: G,
  properties: P,
) {
  return z.object({
    type: z.literal("Feature"),
    geometry,
    properties,
  });
}

export function featureCollectionSchema<F extends z.ZodType>(feature: F) {
  return z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(feature),
  });
}

export interface Feature<G, P> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface FeatureCollection<F> {
  type: "FeatureCollection";
  features: F[];
}

/** [minLon, minLat, maxLon, maxLat] */
export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);
export type BBox = [number, number, number, number];
