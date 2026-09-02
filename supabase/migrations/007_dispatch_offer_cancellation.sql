-- TAGA : distinction explicite entre une offre expirée et une offre annulée
-- parce que le passager a interrompu sa recherche.

alter type public.taga_dispatch_offer_status
  add value if not exists 'cancelled';
