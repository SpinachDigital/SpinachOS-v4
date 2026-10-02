
import sys, importlib.util
spec = importlib.util.spec_from_file_location("laya_main", "main.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
tests = [
    ("postpone the launch", "marketing"),
    ("write a LinkedIn post for Client X", "marketing"),
    ("add a new field to the form", "engineering"),
    ("build a pipeline for gym", "engineering"),
    ("create a social media post", "marketing"),
    ("fix the postpone bug in scheduler", "engineering"),
]
for msg, expected in tests:
    dept, conf = m.classify_department(msg)
    ok = "OK" if dept == expected else "DIFF"
    print(ok + ": " + msg + " -> " + dept + " (" + str(conf) + ") [expected " + expected + "]")
