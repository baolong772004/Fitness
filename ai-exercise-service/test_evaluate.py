"""Artificial labels here test metric arithmetic only, never model accuracy."""
import unittest
from evaluate import SIGNALS, aggregate, score_clip, validate_labels


def labels():
    return {'schemaVersion':1,'sourceType':'REAL','coachConfirmed':True,'reviewer':'UNIT_TEST_ONLY','reviewedAt':'test','cameraView':'SIDE','protocol':{'depthTarget':'HIP_AT_KNEE'},'expectedStatus':'ANALYZABLE','repCount':1,'repetitions':[{'startSeconds':0,'bottomSeconds':1,'endSeconds':2,'signals':{code:{'outcome':'PRESENT' if code=='DEPTH_TARGET' else 'ABSENT','timestampSeconds':1} for code in SIGNALS}}]}


class EvaluationTest(unittest.TestCase):
    def test_empty_ground_truth_has_no_accuracy_numbers(self):
        result=aggregate([])
        self.assertIsNone(result['precision']); self.assertIsNone(result['recall'])
        self.assertIsNone(result['repCountMAE']); self.assertIsNone(result['insufficientDataRate'])

    def test_abstaining_on_positive_counts_as_miss(self):
        score=score_clip(labels(),{'status':'INSUFFICIENT_DATA','detectedRepetitions':None,'repetitions':[]})
        self.assertEqual(score['counts']['DEPTH_TARGET']['fn'],1)
        self.assertEqual(score['counts']['DEPTH_TARGET']['abstained'],1)
        self.assertEqual(score['absoluteRepCountError'],1)
        report=aggregate([{'score':score}])
        self.assertEqual(report['recall'],0); self.assertIsNone(report['precision'])

    def test_duplicate_predictions_do_not_match_same_true_rep(self):
        rep={'startSeconds':0,'bottomSeconds':1,'endSeconds':2,'observations':[{'code':'DEPTH_TARGET','timestampSeconds':1}]}
        score=score_clip(labels(),{'status':'COMPLETED','detectedRepetitions':2,'repetitions':[rep,rep]})
        self.assertEqual(score['counts']['DEPTH_TARGET']['tp'],1)
        self.assertEqual(score['counts']['DEPTH_TARGET']['fp'],1)
        self.assertEqual(score['extraReps'],1)

    def test_edited_unconfirmed_or_incomplete_labels_are_refused(self):
        validate_labels(labels())
        for key,value in [('sourceType','EDITED'),('coachConfirmed',False),('reviewer',''),('repCount',2),('protocol',None),('cameraView','')]:
            label=labels(); label[key]=value
            with self.assertRaises(ValueError): validate_labels(label)


if __name__=='__main__': unittest.main()
