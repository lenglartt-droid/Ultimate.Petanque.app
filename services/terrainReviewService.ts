/**
 * Terrain Review Service
 * Handles CRUD for terrain reviews (5-star ratings + comments + photos).
 */
import { getSupabaseClient } from '@/template';

export interface TerrainReview {
  id: string;
  terrainId: string;
  userId: string;
  playerId?: string;
  playerName?: string;
  rating: number;
  comment?: string;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerrainRatingStats {
  avg: number;
  count: number;
  distribution: number[]; // [1-star, 2-star, 3-star, 4-star, 5-star]
}

/**
 * Fetch all reviews for a terrain.
 */
export async function fetchTerrainReviews(terrainId: string): Promise<{ reviews: TerrainReview[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_reviews')
      .select('*')
      .eq('terrain_id', terrainId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviews: TerrainReview[] = (data || []).map((r: any) => ({
      id: r.id,
      terrainId: r.terrain_id,
      userId: r.user_id,
      playerId: r.player_id,
      playerName: r.player_name,
      rating: r.rating,
      comment: r.comment,
      photoUrl: r.photo_url || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { reviews, error: null };
  } catch (e: any) {
    return { reviews: [], error: e.message || 'Failed to fetch reviews' };
  }
}

/**
 * Compute rating stats from reviews.
 */
export function computeRatingStats(reviews: TerrainReview[]): TerrainRatingStats {
  if (reviews.length === 0) return { avg: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  const dist = [0, 0, 0, 0, 0];
  let total = 0;
  for (const r of reviews) {
    const idx = Math.max(0, Math.min(4, r.rating - 1));
    dist[idx]++;
    total += r.rating;
  }
  return {
    avg: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length,
    distribution: dist,
  };
}

/**
 * Submit or update a review for a terrain.
 */
export async function submitTerrainReview(params: {
  terrainId: string;
  userId: string;
  playerId?: string;
  playerName?: string;
  rating: number;
  comment?: string;
  photoUrl?: string;
}): Promise<{ review: TerrainReview | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_reviews')
      .upsert({
        terrain_id: params.terrainId,
        user_id: params.userId,
        player_id: params.playerId || null,
        player_name: params.playerName || null,
        rating: params.rating,
        comment: params.comment || null,
        photo_url: params.photoUrl || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'terrain_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    const review: TerrainReview = {
      id: data.id,
      terrainId: data.terrain_id,
      userId: data.user_id,
      playerId: data.player_id,
      playerName: data.player_name,
      rating: data.rating,
      comment: data.comment,
      photoUrl: data.photo_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { review, error: null };
  } catch (e: any) {
    return { review: null, error: e.message || 'Failed to submit review' };
  }
}

/**
 * Delete a review.
 */
export async function deleteTerrainReview(reviewId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('terrain_reviews')
      .delete()
      .eq('id', reviewId);
    if (error) throw error;
    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'Failed to delete review' };
  }
}

/**
 * Get current user's review for a terrain.
 */
export async function getMyReview(terrainId: string, userId: string): Promise<TerrainReview | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_reviews')
      .select('*')
      .eq('terrain_id', terrainId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      terrainId: data.terrain_id,
      userId: data.user_id,
      playerId: data.player_id,
      playerName: data.player_name,
      rating: data.rating,
      comment: data.comment,
      photoUrl: data.photo_url || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}
