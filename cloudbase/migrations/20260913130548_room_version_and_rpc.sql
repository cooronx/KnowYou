-- 乐观锁版本号：withLock 用它对房间写入做条件提交
ALTER TABLE "Room" ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

-- 房间不存在时创建；已结束的房间重置为可重开的空房间（原子执行，供 HTTP 通道调用）
CREATE OR REPLACE FUNCTION knowyou_ensure_room(p_code text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_state text;
BEGIN
  SELECT state::text INTO v_state FROM "Room" WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "Room"(code, "updatedAt") VALUES (p_code, now())
    ON CONFLICT ("code") DO NOTHING;
    RETURN;
  END IF;
  IF v_state = 'finished' THEN
    DELETE FROM "Room" WHERE code = p_code;
    INSERT INTO "Room"(code, "updatedAt") VALUES (p_code, now());
  END IF;
END;
$$;

-- 把一次 withLock 的读改写结果原子应用：校验版本、写 Room/Player/Turn/Report、版本号 +1
CREATE OR REPLACE FUNCTION knowyou_apply_room_change(
  p_code text,
  p_expected_version integer,
  p_change jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_version integer;
  v_room jsonb := coalesce(p_change->'room', '{}'::jsonb);
  v_item jsonb;
BEGIN
  SELECT version INTO v_version
  FROM "Room" WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_version <> p_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'conflict');
  END IF;

  UPDATE "Room" SET
    state = (v_room->>'state')::"RoomState",
    round = (v_room->>'round')::integer,
    narration = v_room->>'narration',
    scene = v_room->>'scene',
    "isEnding" = (v_room->>'isEnding')::boolean,
    "endingReason" = v_room->>'endingReason',
    "aiStatus" = (v_room->>'aiStatus')::"AiStatus",
    "aiError" = v_room->>'aiError',
    choices = v_room->'choices',
    submissions = v_room->'submissions',
    "updatedAt" = now(),
    version = version + 1
  WHERE code = p_code;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_change->'newPlayers', '[]'::jsonb)) LOOP
    INSERT INTO "Player"(id, "roomCode", name, role, seat)
    VALUES (
      v_item->>'id',
      p_code,
      v_item->>'name',
      (v_item->>'role')::"PlayerRole",
      (v_item->>'seat')::integer
    );
  END LOOP;

  IF jsonb_typeof(p_change->'deleteTurnsAfterRound') = 'number' THEN
    DELETE FROM "Turn"
    WHERE "roomCode" = p_code
      AND round > (p_change->>'deleteTurnsAfterRound')::integer;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_change->'newTurns', '[]'::jsonb)) LOOP
    INSERT INTO "Turn"(id, "roomCode", round, entries, narration)
    VALUES (
      v_item->>'id',
      p_code,
      (v_item->>'round')::integer,
      v_item->'entries',
      v_item->>'narration'
    );
  END LOOP;

  IF jsonb_typeof(p_change->'reportUpsert') = 'object' THEN
    INSERT INTO "Report"("roomCode", common, differences, complement, topics)
    VALUES (
      p_code,
      ARRAY(SELECT jsonb_array_elements_text(p_change->'reportUpsert'->'common')),
      ARRAY(SELECT jsonb_array_elements_text(p_change->'reportUpsert'->'differences')),
      p_change->'reportUpsert'->>'complement',
      ARRAY(SELECT jsonb_array_elements_text(p_change->'reportUpsert'->'topics'))
    )
    ON CONFLICT ("roomCode") DO UPDATE SET
      common = EXCLUDED.common,
      differences = EXCLUDED.differences,
      complement = EXCLUDED.complement,
      topics = EXCLUDED.topics;
  ELSIF jsonb_typeof(p_change->'reportDelete') = 'boolean' AND (p_change->>'reportDelete')::boolean THEN
    DELETE FROM "Report" WHERE "roomCode" = p_code;
  END IF;

  RETURN jsonb_build_object('ok', true, 'version', v_version + 1);
END;
$$;
