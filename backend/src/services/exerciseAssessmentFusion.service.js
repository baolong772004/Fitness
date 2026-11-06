export const ASSESSMENT_FUSION_VERSION = 'squat-assessment-fusion-1';
const titles = { 'SQUAT-01': 'Chu kỳ Squat', 'SQUAT-02': 'Độ sâu Squat', 'SQUAT-03': 'Hướng di chuyển đầu gối',
    'SQUAT-04': 'Phối hợp hông và thân người', 'SQUAT-05': 'Nhịp Squat', 'SQUAT-06': 'Đối xứng hai bên',
    'SQUAT-07': 'Tiếp xúc bàn chân với sàn', 'SQUAT-08': 'Mục tiêu cá nhân' };
const parts = { LEFT_KNEE: 'Gối trái', RIGHT_KNEE: 'Gối phải', KNEE: 'Đầu gối', HIP: 'Hông', TORSO: 'Thân người', WHOLE_BODY: 'Chuyển động' };
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const n = (value, digits = 2) => Number(value.toFixed(digits)).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const decisive = (status) => ['MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(status);
function viewBlock(id, result) {
    const view = result.cameraView?.detected;
    const protocol = result.protocol || result.requestOptions || {};
    if (!['FRONT', 'SIDE', 'OBLIQUE'].includes(view))
        return 'CAMERA_NOT_VERIFIED';
    if (['SQUAT-02', 'SQUAT-04'].includes(id) && view !== 'SIDE')
        return 'SIDE_VIEW_REQUIRED';
    if (id === 'SQUAT-03' && view !== 'FRONT')
        return 'FRONT_VIEW_REQUIRED';
    if (id === 'SQUAT-02' && protocol.depthTarget !== 'HIP_AT_KNEE')
        return 'DEPTH_TARGET_REQUIRED';
    if (['SQUAT-06', 'SQUAT-07'].includes(id))
        return 'UNSUPPORTED_2D_CRITERION';
    if (id === 'SQUAT-08' && !finite(protocol.descentTargetSeconds) && !(view === 'SIDE' && protocol.depthTarget === 'HIP_AT_KNEE'))
        return 'INDIVIDUAL_TARGET_REQUIRED';
    return null;
}
function unavailableReason(code, id) {
    if (code === 'SIDE_VIEW_REQUIRED')
        return 'Góc quay hiện tại chưa đủ để xác định tiêu chí này. Cần thêm video quay ngang.';
    if (code === 'FRONT_VIEW_REQUIRED')
        return 'Cần góc chính diện để đối chiếu hướng di chuyển đầu gối.';
    if (code === 'CAMERA_NOT_VERIFIED')
        return 'Chưa xác định được góc quay phù hợp. Quay rõ toàn thân từ góc chính diện hoặc ngang.';
    if (code === 'DEPTH_TARGET_REQUIRED')
        return 'Chưa chọn mục tiêu độ sâu để đối chiếu. Chọn mục tiêu phù hợp và quay ngang.';
    if (code === 'INDIVIDUAL_TARGET_REQUIRED')
        return 'Chưa đặt mục tiêu nhịp hoặc độ sâu để so sánh.';
    if (code === 'UNSUPPORTED_2D_CRITERION')
        return id === 'SQUAT-07' ? 'Video chưa xác nhận được mặt sàn và điểm tiếp xúc bàn chân.' : 'Video 2D chưa đủ cơ sở xác nhận đối xứng hai bên cơ thể.';
    if (code === 'SOURCE_CONFLICT')
        return 'Các dấu hiệu quan sát và số đo chưa thống nhất. Chưa đủ cơ sở kết luận đúng hoặc sai; hãy xem lại đoạn video hoặc gửi Coach kiểm tra.';
    if (code === 'UNVALIDATED_RULE_WITHOUT_VISUAL_SUPPORT')
        return 'Số đo có dấu hiệu cần xem lại nhưng hình ảnh chưa xác nhận rõ; tiêu chí này chưa được kiểm chứng để kết luận chỉ từ số đo.';
    if (code === 'VISUAL_FINDING_WITHOUT_MEASUREMENT')
        return 'Có dấu hiệu cần kiểm tra thêm, nhưng chưa đủ số đo và khung hình hỗ trợ để kết luận hoặc hướng dẫn sửa.';
    if (code === 'VISION_UNAVAILABLE')
        return 'Chưa hoàn tất việc đối chiếu hình ảnh. Hiện chưa đủ cơ sở kết luận; có thể thử phân tích lại video.';
    if (code === 'BILATERAL_EVIDENCE_INCOMPLETE')
        return 'Chưa theo dõi đủ rõ cả hai đầu gối ở lần này để kết luận đạt tiêu chí.';
    if (code === 'COMPARISON_DEFINITION_MISSING')
        return 'Chưa có đầy đủ mục tiêu hoặc ngưỡng so sánh cho số đo này; không thể kết luận chỉ dựa trên nhận xét hình ảnh.';
    return 'Số đo hoặc khung hình ở lần này chưa đủ rõ và liên tục để kết luận. Giữ máy cố định và quay rõ toàn thân.';
}
const feedback = {
    'SQUAT-01': ['Theo dõi được trọn pha xuống và đứng lên trong phạm vi thời gian đã kiểm tra.', 'Chu kỳ xuống và đứng lên chưa đáp ứng tiêu chí chuyển động đang kiểm tra.', 'Thực hiện trọn pha xuống rồi đứng lên với tốc độ có kiểm soát.'],
    'SQUAT-02': ['Hình chiếu hông đạt mục tiêu độ sâu đã chọn.', 'Hình chiếu hông còn cao hơn gối ở đáy lần tập so với mục tiêu đã chọn.', 'Hạ người có kiểm soát tới độ sâu phù hợp với mục tiêu; không cố xuống nếu đau.'],
    'SQUAT-03': ['Hướng di chuyển hai đầu gối nằm trong phạm vi đã kiểm tra trên góc chính diện.', 'Có dấu hiệu đầu gối di chuyển vào trong vượt ngưỡng đang kiểm tra trên ảnh chính diện.', 'Kiểm soát đầu gối theo hướng bàn chân và tập chậm để giữ chuyển động ổn định.'],
    'SQUAT-04': ['Phối hợp hông và vai đầu pha đứng lên nằm trong phạm vi đã kiểm tra.', 'Thân gập thêm trong khi hông nâng nhanh hơn vai ở đầu pha lên.', 'Giữ thân ổn định, nâng vai và hông cùng nhau khi đứng lên.'],
    'SQUAT-05': ['Thời gian xuống và lên tương đối ổn định so với các lần trong clip.', 'Nhịp xuống hoặc đứng lên chưa ổn định theo tiêu chí đang kiểm tra.', 'Giảm tốc độ và giữ nhịp xuống/lên đều giữa các lần tập.'],
    'SQUAT-08': ['Lần tập phù hợp mục tiêu cá nhân đã chọn trong phạm vi đo được.', 'Nhịp hoặc độ sâu chưa khớp mục tiêu cá nhân đã chọn.', 'Điều chỉnh nhịp hoặc độ sâu theo mục tiêu đã chọn.'],
};
function improvementGuidance(id, status, reasonCode, correction, result) {
    if (status === 'NEEDS_IMPROVEMENT') {
        const actions = {
            'SQUAT-01': ['Thực hiện trọn pha hạ người rồi đứng lên, giữ chuyển động có kiểm soát.', 'Quay trọn lần tiếp theo từ tư thế đứng đến khi đứng lại.'],
            'SQUAT-02': ['Hạ người có kiểm soát tới mục tiêu độ sâu phù hợp đã chọn.', 'Quay ngang, thấy rõ hông và gối ở điểm thấp nhất để kiểm tra lại.'],
            'SQUAT-03': ['Giữ đầu gối di chuyển theo hướng bàn chân trong pha xuống và đứng lên.', 'Tập chậm hơn ở lần tiếp theo và quay chính diện để kiểm tra hướng gối.'],
            'SQUAT-04': ['Nâng vai và hông cùng nhau khi đứng lên, giữ thân ổn định.', 'Quay ngang lần tiếp theo để xem lại thời điểm bắt đầu đứng lên.'],
            'SQUAT-05': ['Giữ nhịp hạ người và đứng lên đều giữa các lần tập.', 'Xem đoạn lệch nhịp đã đánh dấu, rồi thực hiện lại với tốc độ có kiểm soát.'],
            'SQUAT-08': ['Điều chỉnh theo mục tiêu nhịp hoặc độ sâu đã chọn.', 'Quay lại một lần tập trọn vẹn để so sánh với mục tiêu đó.'],
        };
        const steps = [...(actions[id] || ['Thực hiện lại với chuyển động có kiểm soát.'])];
        if (id === 'SQUAT-08') {
            const target = (result.protocol || result.requestOptions)?.descentTargetSeconds;
            if (finite(target)) steps[0] = `Giữ pha hạ người khoảng ${n(target)} giây theo mục tiêu bạn đã chọn.`;
        }
        return { kind: 'CORRECT', title: 'Cách cải thiện động tác', steps: [...new Set([correction || steps[0], steps[1]].filter(Boolean))] };
    }
    if (status === 'MEETS_CRITERION') {
        const maintain = {
            'SQUAT-01': 'Tiếp tục thực hiện trọn pha xuống và đứng lên với chuyển động có kiểm soát.',
            'SQUAT-02': 'Duy trì độ sâu theo mục tiêu đã chọn và kiểm soát đường xuống.',
            'SQUAT-03': 'Tiếp tục giữ đầu gối di chuyển theo hướng bàn chân như phần đã quan sát.',
            'SQUAT-04': 'Duy trì việc nâng hông và vai cùng nhau khi đứng lên.',
            'SQUAT-05': 'Duy trì nhịp xuống và lên ổn định giữa các lần tập.',
            'SQUAT-08': 'Tiếp tục bám mục tiêu nhịp hoặc độ sâu đã chọn.',
        };
        return { kind: 'MAINTAIN', title: 'Tiếp tục duy trì', steps: [maintain[id] || 'Duy trì cách thực hiện trong phạm vi đã đánh giá.'] };
    }
    if (reasonCode === 'SIDE_VIEW_REQUIRED') return { kind: 'RECORD_AGAIN', title: 'Để đánh giá rõ hơn', steps: ['Quay thêm góc ngang, thấy trọn vai, hông, gối và bàn chân.', 'Giữ máy cố định và quay trọn một lần xuống rồi đứng lên.'] };
    if (reasonCode === 'FRONT_VIEW_REQUIRED' || reasonCode === 'BILATERAL_EVIDENCE_INCOMPLETE') return { kind: 'RECORD_AGAIN', title: 'Để đánh giá rõ hơn', steps: ['Quay chính diện, thấy rõ cả hai đầu gối và bàn chân suốt lần tập.'] };
    if (reasonCode === 'DEPTH_TARGET_REQUIRED' || reasonCode === 'INDIVIDUAL_TARGET_REQUIRED') return { kind: 'RECORD_AGAIN', title: 'Bước tiếp theo', steps: ['Chọn mục tiêu nhịp hoặc độ sâu phù hợp trước khi gửi lại video.', 'Nếu chọn mục tiêu độ sâu, quay từ góc ngang để đối chiếu.'] };
    if (reasonCode === 'UNSUPPORTED_2D_CRITERION' || reasonCode === 'COMPARISON_DEFINITION_MISSING') return { kind: 'REVIEW', title: 'Bước tiếp theo', steps: ['Gửi video cho Coach xem lại tiêu chí này; quay lại video đơn thuần có thể chưa giải quyết được giới hạn phân tích.'] };
    if (reasonCode === 'SOURCE_CONFLICT' || reasonCode === 'VISUAL_FINDING_WITHOUT_MEASUREMENT') return { kind: 'REVIEW', title: 'Cần kiểm tra trước khi sửa', steps: ['Xem lại chuyển động cần kiểm tra; chưa coi dấu hiệu này là lỗi đã xác định.', 'Quay lại rõ hơn ở góc phù hợp hoặc gửi Coach kiểm tra.'] };
    if (reasonCode === 'VISION_UNAVAILABLE') return { kind: 'RECORD_AGAIN', title: 'Bước tiếp theo', steps: ['Thử hoàn tất đánh giá lại với video còn lưu; chưa cần thay đổi tư thế dựa trên mục chưa kết luận.'] };
    return { kind: 'RECORD_AGAIN', title: 'Để đánh giá rõ hơn', steps: ['Quay ở nơi đủ sáng, giữ máy cố định và thấy rõ toàn thân suốt một lần tập.'] };
}
function repImprovementPlan(criteria) {
    const failures = criteria.filter(item => item.guidance.kind === 'CORRECT');
    const nextActions = criteria.filter(item => item.status === 'UNABLE_TO_ASSESS' && item.guidance.kind !== 'MAINTAIN');
    const maintenance = criteria.filter(item => item.guidance.kind === 'MAINTAIN');
    const priority = ['SQUAT-03', 'SQUAT-04', 'SQUAT-02', 'SQUAT-05', 'SQUAT-08', 'SQUAT-01'];
    failures.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
    const selected = failures.length ? [...failures.slice(0, 2), ...nextActions.slice(0, 1)]
        : [...maintenance.slice(0, 1), ...nextActions.slice(0, 1)];
    const items = selected.map(item => ({ criterionId: item.id, ...item.guidance, title: item.title }));
    return { title: failures.length ? 'Ưu tiên cải thiện ở lần tập tiếp theo' : maintenance.length ? 'Duy trì và bổ sung ở lần tiếp theo' : 'Làm gì để đánh giá rõ hơn', items };
}
function scalar(id, value) {
    if (finite(value))
        return value;
    if (!value || typeof value !== 'object')
        return null;
    const field = { 'SQUAT-01': 'totalSeconds', 'SQUAT-02': 'hipAboveKneeRatio', 'SQUAT-03': 'inwardChangeStanceRatio',
        'SQUAT-04': 'earlyAscentLeanChangeDegrees', 'SQUAT-08': 'descentSeconds' }[id];
    if (field && finite(value[field]))
        return value[field];
    if (id === 'SQUAT-05' && finite(value.descentDifferenceFromClipMedianSeconds) && finite(value.ascentDifferenceFromClipMedianSeconds))
        return Math.max(Math.abs(value.descentDifferenceFromClipMedianSeconds), Math.abs(value.ascentDifferenceFromClipMedianSeconds));
    return null;
}
function evidenceValid(row, rep, id) {
    if (!decisive(row.status) || !finite(scalar(id, row.observedValue)) || row.measurementQuality?.sufficientForExperimentalComparison !== true ||
        !finite(row.timestampSeconds) || row.timestampSeconds < rep.startSeconds || row.timestampSeconds > rep.endSeconds)
        return false;
    return (row.landmarkEvidence || []).some((frame) => finite(frame.timestampSeconds) &&
        Math.abs(frame.timestampSeconds - row.timestampSeconds) <= 0.2 && frame.timestampSeconds >= rep.startSeconds && frame.timestampSeconds <= rep.endSeconds &&
        Object.values(frame.landmarks || {}).filter((point) => finite(point.x) && finite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 && point.visibility >= 0.6).length >= 2);
}
// Reproduce the configured comparison from measured values. Model confidence is
// deliberately not a substitute for a measurable threshold or visible joints.
function measuredDecision(id, row, rep, result) {
    const value = scalar(id, row.observedValue);
    const max = row.threshold?.maximum;
    if (!finite(value)) return 'UNABLE_TO_ASSESS';
    let meets;
    if (id === 'SQUAT-01' && finite(row.threshold?.minimum) && finite(max) && finite(rep.descentSeconds) && finite(rep.ascentSeconds))
        meets = value >= row.threshold.minimum && value <= max && rep.descentSeconds >= 0.2 && rep.ascentSeconds >= 0.2;
    else if (id === 'SQUAT-02' && (result.protocol || result.requestOptions)?.depthTarget === 'HIP_AT_KNEE') meets = value <= 0;
    else if (id === 'SQUAT-03' && finite(max)) meets = value <= max;
    else if (id === 'SQUAT-04' && finite(max) && finite(row.threshold?.hipShoulderRiseMaximum)) {
        const raw = result.techniqueEvaluation?.criteria?.find(item => (item.criterionId || item.code) === id)?.measurement?.perRep?.find(item => item.repNumber === rep.number)?.observedValue;
        if (finite(raw?.hipShoulderRiseDifferenceRatio)) meets = !(value >= max && raw.hipShoulderRiseDifferenceRatio >= row.threshold.hipShoulderRiseMaximum);
    }
    else if (id === 'SQUAT-05' && finite(max) && finite(rep.descentSeconds) && finite(rep.ascentSeconds))
        meets = value <= max && rep.descentSeconds >= 0.25 && rep.ascentSeconds >= 0.25;
    else if (id === 'SQUAT-08' && finite(max)) {
        const protocol = result.protocol || result.requestOptions || {};
        const hasTempo = finite(protocol.descentTargetSeconds);
        const hasDepth = protocol.depthTarget === 'HIP_AT_KNEE' && result.cameraView?.detected === 'SIDE';
        const raw = result.techniqueEvaluation?.criteria?.find(item => (item.criterionId || item.code) === id)?.measurement?.perRep?.find(item => item.repNumber === rep.number)?.observedValue;
        if (hasTempo && hasDepth && !finite(raw?.hipAboveKneeRatio)) return 'UNABLE_TO_ASSESS';
        meets = value <= max && (!finite(row.threshold?.minimum) || value >= row.threshold.minimum)
            && (!(hasTempo && hasDepth) || raw.hipAboveKneeRatio <= 0);
    }
    return meets === undefined ? 'UNABLE_TO_ASSESS' : meets ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
}
function strongEvidence(row) {
    const quality = row.measurementQuality || {};
    return quality.continuousTracking === true && (quality.referenceRequired === false || quality.stableReference === true)
        && (row.landmarkEvidence || []).length >= 2;
}
function measurement(id, row, rep, result) {
    const value = scalar(id, row.observedValue);
    if (!finite(value))
        return '';
    const max = row.threshold?.maximum;
    if (id === 'SQUAT-01')
        return `Chu kỳ ${n(value)} giây${finite(rep.descentSeconds) ? ` · xuống ${n(rep.descentSeconds)} giây` : ''}${finite(rep.ascentSeconds) ? ` · lên ${n(rep.ascentSeconds)} giây` : ''}.`;
    if (id === 'SQUAT-03')
        return `Dịch vào trong ${n(value * 100, 1)}% khoảng cách hai chân${finite(max) ? `; ngưỡng thử nghiệm ≤ ${n(max * 100, 1)}%` : ''}.`;
    if (id === 'SQUAT-02')
        return `Hông cao hơn gối ${n(value, 3)} lần chiều dài đùi trên ảnh; đối chiếu mục tiêu độ sâu đã chọn.`;
    if (id === 'SQUAT-04') {
        const obs = result.techniqueEvaluation?.criteria?.find((item) => (item.criterionId || item.code) === id)?.measurement?.perRep?.find((item) => item.repNumber === rep.number)?.observedValue;
        return `Thân nghiêng thêm ${n(value)}°${finite(obs?.hipShoulderRiseDifferenceRatio) ? ` · chênh nâng hông/vai ${n(obs.hipShoulderRiseDifferenceRatio, 3)} lần chiều dài thân` : ''}.`;
    }
    if (id === 'SQUAT-05')
        return `${finite(rep.descentSeconds) ? `Xuống ${n(rep.descentSeconds)} giây` : 'Pha xuống chưa có số đo'} · ${finite(rep.ascentSeconds) ? `lên ${n(rep.ascentSeconds)} giây` : 'pha lên chưa có số đo'}. Lệch tối đa ${n(value)} giây so với nhịp trung vị của clip${finite(max) ? `; ngưỡng thử nghiệm ${n(max)} giây` : ''}.`;
    if (id === 'SQUAT-08')
        return `Giá trị quan sát ${n(value)} ${row.units === 'seconds' ? 'giây' : 'lần chiều dài đùi trên ảnh'}; đối chiếu mục tiêu cá nhân đã chọn.`;
    return '';
}
export function buildSquatAssessment(result) {
    if (result?.exercise !== 'SQUAT')
        return null;
    const candidates = result.provisionalEvaluation?.criteria || result.experimentalEvaluation?.criteria || [];
    const diagnostics = [];
    const reps = (result.repetitions || []).map((rawRep, index) => {
        const rep = { ...rawRep, number: rawRep.number ?? index + 1 };
        const criteria = Object.entries(titles).map(([id, title]) => {
            const candidate = candidates.find((item) => (item.criterionId || item.id) === id);
            const official = result.techniqueEvaluation?.criteria?.find((item) => (item.criterionId || item.code) === id);
            const validated = official?.validation === 'APPROVED_AND_VIDEO_VALIDATED' && !!official.approval;
            const sourceRows = validated ? official.verdicts || [] : candidate?.predictions || [];
            const rows = sourceRows.filter((row) => (row.repNumber ?? row.rep) === rep.number);
            const validRows = rows.filter((row) => evidenceValid(row, rep, id)).map(row => {
                const measuredStatus = validated ? row.status : measuredDecision(id, row, rep, result);
                return { ...row, sourceRuleStatus: row.status, status: decisive(measuredStatus) ? measuredStatus : row.status,
                    measurementCompared: decisive(measuredStatus), strongMeasurement: strongEvidence(row) && decisive(measuredStatus) };
            });
            const failure = validRows.find((row) => row.status === 'NEEDS_IMPROVEMENT');
            const bothKnees = id !== 'SQUAT-03' || ['LEFT', 'RIGHT'].every(side => validRows.some((row) => row.side === side || row.bodyPart === `${side}_KNEE`));
            const ruleStatus = failure ? 'NEEDS_IMPROVEMENT' : rows.length && validRows.length === rows.length && bothKnees && validRows.every((row) => row.status === 'MEETS_CRITERION') ? 'MEETS_CRITERION' : 'UNABLE_TO_ASSESS';
            const vision = result.visionAnalysis?.status === 'COMPLETED' ? result.visionAnalysis.assessments?.find((item) => item.repNumber === rep.number && item.criterionId === id) : undefined;
            const visionStatus = vision?.sourceStatus || vision?.status || 'UNABLE_TO_ASSESS';
            const visualTimeValid = finite(vision?.timestampSeconds) && vision.timestampSeconds >= rep.startSeconds && vision.timestampSeconds <= rep.endSeconds;
            const visualMatch = visualTimeValid && validRows.some((row) => row.status === ruleStatus &&
                (['SQUAT-01', 'SQUAT-05'].includes(id) || Math.abs(row.timestampSeconds - vision.timestampSeconds) <= 0.4));
            const strongRuleEvidence = ruleStatus === 'NEEDS_IMPROVEMENT' ? !!failure?.strongMeasurement
                : validRows.length > 0 && validRows.every(row => row.strongMeasurement) && bothKnees;
            const conflict = decisive(ruleStatus) && decisive(visionStatus) && ruleStatus !== visionStatus;
            let reasonCode = result.exerciseVariant !== 'BODYWEIGHT' ? 'VARIANT_NOT_SUPPORTED' : result.status !== 'COMPLETED' ? 'INPUT_QUALITY_INSUFFICIENT' : viewBlock(id, result);
            let status = 'UNABLE_TO_ASSESS';
            let validation = 'NOT_ASSESSED';
            if (!reasonCode) {
                if (ruleStatus === 'UNABLE_TO_ASSESS')
                    reasonCode = decisive(visionStatus) ? 'VISUAL_FINDING_WITHOUT_MEASUREMENT' : !bothKnees && validRows.length ? 'BILATERAL_EVIDENCE_INCOMPLETE' : 'INSUFFICIENT_MEASUREMENT_EVIDENCE';
                else if (validated) {
                    status = ruleStatus;
                    validation = 'VERIFIED';
                    reasonCode = conflict ? 'VALIDATED_EVIDENCE_RESOLVES_CONFLICT' : 'VALIDATED_RULE_WITH_EVIDENCE';
                }
                else if (conflict && visualMatch) reasonCode = 'SOURCE_CONFLICT';
                else if (strongRuleEvidence) {
                    status = ruleStatus;
                    validation = 'PROVISIONAL';
                    reasonCode = conflict ? 'STRONG_MEASUREMENT_RESOLVES_UNALIGNED_VISION' : 'STRONG_MEASUREMENT_ESTIMATE';
                }
                else if (visionStatus === ruleStatus && visualMatch && (failure ? failure.measurementCompared : validRows.every(row => row.measurementCompared))) {
                    status = ruleStatus;
                    validation = 'PROVISIONAL';
                    reasonCode = 'CORROBORATED_PROVISIONAL_EVIDENCE';
                }
                else
                    reasonCode = validRows.some(row => !row.measurementCompared) ? 'COMPARISON_DEFINITION_MISSING' : conflict ? 'SOURCE_CONFLICT' : !vision || result.visionAnalysis?.status !== 'COMPLETED' ? 'VISION_UNAVAILABLE' : 'UNVALIDATED_RULE_WITHOUT_VISUAL_SUPPORT';
            }
            const agreed = status !== 'UNABLE_TO_ASSESS' && visionStatus === status && visualMatch;
            const sourceText = vision?.sourceObservation || vision?.observation;
            const sourceCorrection = vision?.sourceCorrection || vision?.correction;
            const explanation = status === 'UNABLE_TO_ASSESS' ? unavailableReason(reasonCode, id)
                : agreed && sourceText ? sourceText : feedback[id]?.[status === 'MEETS_CRITERION' ? 0 : 1] || '';
            const correction = status === 'NEEDS_IMPROVEMENT' ? agreed && sourceCorrection ? sourceCorrection : feedback[id]?.[2] || '' : '';
            const details = viewBlock(id, result) ? [] : validRows.map((row) => ({ bodyPart: parts[row.bodyPart] || 'Chuyển động',
                measurement: measurement(id, row, rep, result), timestampSeconds: row.timestampSeconds,
                joints: [...new Set((row.landmarkEvidence || []).flatMap((frame) => Object.keys(frame.landmarks || {})))] }));
            diagnostics.push({ repNumber: rep.number, criterionId: id, ruleStatus, visionStatus, ruleValidated: validated,
                reasonCode, measurementRows: validRows.length, visualTimeAligned: !!visualMatch, strongMeasurement: strongRuleEvidence,
                sourceConflict: conflict, conflictResolved: conflict && status !== 'UNABLE_TO_ASSESS' });
            return { id, title, status, validation, explanation, correction, details,
                guidance: improvementGuidance(id, status, reasonCode, correction, result),
                needsReview: status === 'UNABLE_TO_ASSESS' && ['SOURCE_CONFLICT', 'VISUAL_FINDING_WITHOUT_MEASUREMENT', 'UNVALIDATED_RULE_WITHOUT_VISUAL_SUPPORT'].includes(reasonCode), reasonCode };
        });
        const meets = criteria.filter(item => item.status === 'MEETS_CRITERION').length;
        const improves = criteria.filter(item => item.status === 'NEEDS_IMPROVEMENT').length;
        const unable = criteria.filter(item => item.status === 'UNABLE_TO_ASSESS').length;
        const requiredIds = result.cameraView?.detected === 'FRONT' ? ['SQUAT-01', 'SQUAT-03', 'SQUAT-05']
            : result.cameraView?.detected === 'SIDE' ? ['SQUAT-01', 'SQUAT-04', 'SQUAT-05'] : ['SQUAT-01', 'SQUAT-05'];
        const protocol = result.protocol || result.requestOptions || {};
        if (result.cameraView?.detected === 'SIDE' && protocol.depthTarget === 'HIP_AT_KNEE') requiredIds.push('SQUAT-02');
        if (finite(protocol.descentTargetSeconds)) requiredIds.push('SQUAT-08');
        const meetsObserved = !improves && requiredIds.every(id => criteria.find(item => item.id === id)?.status === 'MEETS_CRITERION')
            && !criteria.some(item => item.needsReview);
        return { repNumber: rep.number, criteria, meets, improves, unable,
            improvementPlan: repImprovementPlan(criteria),
            status: improves ? 'NEEDS_IMPROVEMENT' : meetsObserved ? 'MEETS_OBSERVED_CRITERIA' : meets ? 'PARTIALLY_ASSESSED' : 'UNABLE_TO_ASSESS',
            headline: improves ? 'Cần điều chỉnh kỹ thuật trong phạm vi đã kiểm tra' : meetsObserved ? 'Dự đoán đạt trong phạm vi quan sát được' : meets ? 'Đánh giá một phần; chưa kết luận cả động tác đúng' : 'Chưa đủ cơ sở kết luận',
            requiredForObservedView: requiredIds,
            reviewRequired: criteria.some(item => item.needsReview) };
    });
    return { assessment: { version: ASSESSMENT_FUSION_VERSION, scope: 'PER_CRITERION_2D_ONLY', wholeExerciseStatus: 'NOT_CONFIRMED', reps }, diagnostics };
}
export function attachSquatAssessment(result) {
    const fused = buildSquatAssessment(result);
    return fused ? { ...result, assessment: fused.assessment, assessmentDiagnostics: fused.diagnostics } : result;
}
