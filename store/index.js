import { Children, createContext, useContext, useMemo, useReducer, useEffect } from 'react';
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Alert } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

const MyContext = createContext();
MyContext.displayName = "vbdvabv";

const reducer = (state, action) => {
    switch (action.type) {
        case "USER_LOGIN":
            return { ...state, userLogin: action.value };
        case "LOGOUT":
            return { ...state, userLogin: null };
        default:
            return new Error("Action not found");
    }
};

const MyContextControllerProvider = ({ children }) => {
    const initialState = {
        userLogin: null,
        services: [],
    };
    const [controller, dispatch] = useReducer(reducer, initialState);

    const value = useMemo(() => [controller, dispatch], [controller, dispatch]);

    // Tải dữ liệu người dùng từ AsyncStorage khi khởi động
    useEffect(() => {
        const loadUserData = async () => {
            const userData = await AsyncStorage.getItem('userLogin');
            if (userData) {
                dispatch({ type: "USER_LOGIN", value: JSON.parse(userData) });
            }
        };
        loadUserData();
    }, []);

    return (
        <MyContext.Provider value={value}>
            {children}
        </MyContext.Provider>
    );
};

const useMyContextController = () => {
    const context = useContext(MyContext);
    if (context == null)
        return new Error("useMyContextController must be inside MyContextControllerProvider");
    return context;
};

const USERS = firestore().collection("USERS");

const CreateAccount = async (fullname, email, password, phone, address, department) => {
    try {
        const userDoc = await USERS.doc(email).get();
        if (userDoc.exists) {
            Alert.alert("Email đã tồn tại");
            return;
        }

        await auth().createUserWithEmailAndPassword(email, password);
        await USERS.doc(email).set({
            fullname,
            email,
            password,
            phone,
            address,
            department,
            role: "user",
            note: "",
            avatar: ""
        });
        Alert.alert("Tạo tài khoản thành công với email: " + email, [
            {
                text: "Xác nhận",
                onPress: () => navigation.navigate("Login")
            }
        ]);
    } catch (error) {
        Alert.alert("Tạo tài khoản thất bại", error.message);
    }
};

const login = (dispatch, email, password) => {
    auth().signInWithEmailAndPassword(email, password)
        .then(async () => {
            const userDoc = await firestore().collection("USERS").doc(email).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.banned) {
                    Alert.alert("Bạn đã bị cấm", "Vui lòng liên hệ Admin.");
                    auth().signOut(); // Đăng xuất người dùng bị cấm
                } else {
                    dispatch({ type: "USER_LOGIN", value: userData });
                    await AsyncStorage.setItem('userLogin', JSON.stringify(userData)); // Lưu dữ liệu người dùng
                }
            } else {
                Alert.alert("Lỗi", "Tài khoản không tồn tại.");
            }
        })
        .catch(e => Alert.alert("Email hoặc Password không đúng"));
};

const logout = (dispatch) => {
    auth().signOut()
        .then(() => {
            dispatch({ type: "LOGOUT" });
            AsyncStorage.removeItem('userLogin'); // Xóa dữ liệu người dùng
        });
};

const banUser = async (email) => {
    try {
        await firestore().collection("USERS").doc(email).update({
            banned: true,
            bannedAt: firestore.FieldValue.serverTimestamp()
        });
        Alert.alert("Thông báo", "Tài khoản đã bị cấm thành công!");
    } catch (error) {
        console.error("Error banning account: ", error);
        Alert.alert("Lỗi", "Có lỗi xảy ra khi cấm tài khoản. Vui lòng thử lại sau.");
    }
};

const unbanUser = async (email) => {
    try {
        await firestore().collection("USERS").doc(email).update({
            banned: false,
            unbannedAt: firestore.FieldValue.serverTimestamp()
        });
        Alert.alert("Thông báo", "Tài khoản đã được bỏ cấm thành công!");
    } catch (error) {
        console.error("Lỗi hủy cấm tài khoản: ", error);
        Alert.alert("Lỗi", "Có lỗi xảy ra khi bỏ cấm tài khoản. Vui lòng thử lại sau.");
    }
};

const deleteUserAccount = async (email, password) => {
    try {
        // Đăng nhập tạm thời vào tài khoản của người dùng
        await auth().signInWithEmailAndPassword(email, password);

        // Lấy người dùng hiện tại
        const user = auth().currentUser;

        // Xóa tài khoản từ Firebase Authentication
        await user.delete();

        // Xóa tài khoản từ Firestore
        await firestore().collection("USERS").doc(email).delete();

        console.log(`Tài khoản ${email} đã được xóa thành công.`);
    } catch (error) {
        console.error("Error deleting user account: ", error);
        throw error;
    }
};

export {
    MyContextControllerProvider,
    useMyContextController,
    CreateAccount,
    login,
    logout,
    banUser,
    unbanUser,
    deleteUserAccount
};
