import { StyleSheet, Text, View, Modal, Pressable } from 'react-native';
/** ---------- 추천 미션(선물 UI) ---------- **/

const GiftRecommend = ({ visible, mission, onAccept, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.giftCard}>
          <Text style={styles.giftEmoji}>🎁</Text>
          <Text style={styles.giftTitle}>오늘의 추천 미션</Text>
          <Text style={styles.giftMission}>{mission}</Text>

          <View style={styles.giftBtns}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onAccept}>
              <Text style={styles.btnPrimaryText}>수락하기</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={styles.btnGhostText}>다음에</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  /** 버튼 공통 **/
  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#111827',
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnGhostText: {
    color: '#4b5563',
    fontWeight: '600',
  },
  /** 선물 모달 **/
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  giftCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  giftEmoji: {
    fontSize: 36,
  },
  giftTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  giftMission: {
    fontSize: 20,
    marginVertical: 12,
    textAlign: 'center',
  },
  giftBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});

export default GiftRecommend;
