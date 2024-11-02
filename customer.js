// Main Registration Application
document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const CONFIG = {
        VERIFICATION: {
            CODE_LENGTH: 6,
            MAX_ATTEMPTS: 3,
            CODE_EXPIRY: 120, // seconds
            RESEND_COOLDOWN: 60, // seconds
            LOCK_DURATION: 15 * 60 * 1000 // 15 minutes
        },
        VALIDATION: {
            PHONE_REGEX: /^\d{10}$/,
            EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        ENDPOINTS: {
            SEND_CODE: '/api/verify/send-code',
            VERIFY_CODE: '/api/verify/check-code'
        }
    };

    // Utility Functions
    const Utils = {
        formatPhoneNumber(countryCode, phoneNumber) {
            const cleaned = phoneNumber.replace(/\D/g, '');
            return `${countryCode} ${cleaned}`;
        },

        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
        },

        showError(elementId, message) {
            const errorElement = document.getElementById(`${elementId}Error`);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            }
        },

        clearError(elementId) {
            const errorElement = document.getElementById(`${elementId}Error`);
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        },

        showLoading(container) {
            const loader = container.querySelector('.loading-overlay');
            if (loader) loader.style.display = 'flex';
        },

        hideLoading(container) {
            const loader = container.querySelector('.loading-overlay');
            if (loader) loader.style.display = 'none';
        },

        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }
    };

    // State Management
    class FormState {
        constructor() {
            this.data = {
                currentStep: 1,

                accountType: null,
                phone: {
                    number: null,
                    countryCode: null,
                    isVerified: false
                },
                // Add this section
            personalInfo: {
                firstName: null,
                lastName: null,
                email: null
            }
            };
            this.listeners = {};
        }

        // Add this new method
    setPersonalInfo(info) {
        this.data.personalInfo = { ...this.data.personalInfo, ...info };
        this.notifyListeners('personalInfo');
    }

        setAccountType(type) {
            this.data.accountType = type;
            this.notifyListeners('accountType');
        }

        setPhoneData(phoneData) {
            this.data.phone = { ...this.data.phone, ...phoneData };
            this.notifyListeners('phone');
        }

        setStep(step) {
            this.data.currentStep = step;
            this.notifyListeners('step');
        }

        subscribe(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
        }

        notifyListeners(event) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(callback => callback(this.data));
            }
        }
    }

    // Account Type Selection
    class AccountTypeSelector {
        constructor(formState) {
            this.formState = formState;
            this.container = document.getElementById('step1');
            this.initializeElements();
            this.bindEvents();
        }

        initializeElements() {
            this.cards = this.container.querySelectorAll('.account-type-card');
            this.nextButton = this.container.querySelector('.btn-next');
        }

        bindEvents() {
            this.cards.forEach(card => {
                card.addEventListener('click', (e) => this.handleCardSelection(e));
            });

            this.nextButton.addEventListener('click', () => this.handleNextClick());
        }

        handleCardSelection(event) {
            this.cards.forEach(card => card.classList.remove('selected'));
            
            const selectedCard = event.currentTarget;
            selectedCard.classList.add('selected');
            
            this.formState.setAccountType(selectedCard.dataset.type);
            this.nextButton.classList.add('active');
        }

        handleNextClick() {
            if (this.formState.data.accountType) {
                this.container.style.display = 'none';
                this.formState.setStep(2);
                document.getElementById('step2').style.display = 'block';
            }
        }
    }

    // Phone Verification
    class PhoneVerification {
        constructor(formState) {
            this.formState = formState;
            this.container = document.getElementById('step2');
            this.verificationCode = '';
            this.attempts = 0;
            this.timers = {
                codeExpiry: null,
                resendCooldown: null
            };
            
            this.initializeElements();
            this.bindEvents();
        }

        initializeElements() {
            this.elements = {
                phoneInput: this.container.querySelector('#phoneNumber'),
                countryCode: this.container.querySelector('#countryCode'),
                sendCodeBtn: this.container.querySelector('#sendCodeBtn'),
                backButton: this.container.querySelector('#backToAccount'),
                editPhoneBtn: this.container.querySelector('#editPhone'),
                resendCodeBtn: this.container.querySelector('#resendCode'),
                phoneStep: this.container.querySelector('#phoneInputStep'),
                codeStep: this.container.querySelector('#codeVerificationStep'),
                displayPhone: this.container.querySelector('#displayPhone'),
                status: this.container.querySelector('#verificationStatus'),
                countdown: this.container.querySelector('#countdown'),
                resendTimer: this.container.querySelector('#resendTimer'),
                codeInputs: this.container.querySelectorAll('.code-digit')
            };
        }

        bindEvents() {
            this.elements.phoneInput.addEventListener('input', 
                Utils.debounce(e => this.validatePhoneNumber(e.target.value), 300));

            this.elements.codeInputs.forEach((input, index) => {
                input.addEventListener('input', (e) => this.handleCodeInput(e, index));
                input.addEventListener('keydown', (e) => this.handleCodeKeydown(e, index));
                input.addEventListener('paste', (e) => this.handleCodePaste(e));
            });

            this.elements.sendCodeBtn.addEventListener('click', () => this.sendCode());
            this.elements.backButton.addEventListener('click', () => this.goBack());
            this.elements.editPhoneBtn.addEventListener('click', () => this.editPhone());
            this.elements.resendCodeBtn.addEventListener('click', () => this.resendCode());
        }

        validatePhoneNumber(phone) {
            const isValid = CONFIG.VALIDATION.PHONE_REGEX.test(phone);
        
            // Update button state
            this.elements.sendCodeBtn.disabled = !isValid;
            
            // Update button visual state with active class
            if (isValid) {
                this.elements.sendCodeBtn.classList.add('active');
            } else {
                this.elements.sendCodeBtn.classList.remove('active');
            }

            // Show/clear error message
            if (phone.length > 0 && !isValid) {
                Utils.showError('phone', 'Please enter a valid 10-digit phone number');
            } else {
                Utils.clearError('phone');
            }

            return isValid;
        }

        async sendCode() {
            if (!this.validatePhoneNumber(this.elements.phoneInput.value)) {
                return;
            }

            Utils.showLoading(this.container);
            
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                console.log('Verification code:', this.verificationCode);

                this.showCodeStep();
                this.startCountdown();
                this.startResendTimer();
            } catch (error) {
                this.showError('Failed to send code. Please try again.');
            } finally {
                Utils.hideLoading(this.container);
            }
        }

        showCodeStep() {
            const formattedNumber = Utils.formatPhoneNumber(
                this.elements.countryCode.value,
                this.elements.phoneInput.value
            );
            
            this.elements.displayPhone.textContent = formattedNumber;
            this.elements.phoneStep.style.display = 'none';
            this.elements.codeStep.style.display = 'block';
            this.elements.codeInputs[0].focus();
        }

        handleCodeInput(event, index) {
            const input = event.target;
            const value = input.value;

            if (!/^\d*$/.test(value)) {
                input.value = '';
                return;
            }

            if (value.length === 1 && index < this.elements.codeInputs.length - 1) {
                this.elements.codeInputs[index + 1].focus();
            }

            if (this.isCodeComplete()) {
                this.verifyCode();
            }
        }

        handleCodeKeydown(event, index) {
            if (event.key === 'Backspace' && !event.target.value && index > 0) {
                this.elements.codeInputs[index - 1].focus();
            }
        }

        handleCodePaste(event) {
            event.preventDefault();
            const pastedData = event.clipboardData.getData('text')
                .replace(/\D/g, '')
                .slice(0, CONFIG.VERIFICATION.CODE_LENGTH);
                
            [...pastedData].forEach((digit, index) => {
                if (this.elements.codeInputs[index]) {
                    this.elements.codeInputs[index].value = digit;
                }
            });

            if (this.isCodeComplete()) {
                this.verifyCode();
            }
        }

        isCodeComplete() {
            return Array.from(this.elements.codeInputs)
                .every(input => input.value.length === 1);
        }

        verifyCode() {
            const enteredCode = Array.from(this.elements.codeInputs)
                .map(input => input.value)
                .join('');
                
            if (enteredCode === this.verificationCode) {
                this.handleVerificationSuccess();
            } else {
                this.handleVerificationFailure();
            }
        }

        handleVerificationSuccess() {
            this.showSuccess('Phone verified successfully!');
            
            this.formState.setPhoneData({
                number: this.elements.phoneInput.value,
                countryCode: this.elements.countryCode.value,
                isVerified: true
            });
        }

        handleVerificationFailure() {
            this.attempts++;
            if (this.attempts >= CONFIG.VERIFICATION.MAX_ATTEMPTS) {
                this.showError('Too many attempts. Please try again later.');
                this.lockVerification();
            } else {
                this.showError(`Invalid code. ${CONFIG.VERIFICATION.MAX_ATTEMPTS - this.attempts} attempts remaining.`);
            }
        }

        startCountdown() {
            let timeLeft = CONFIG.VERIFICATION.CODE_EXPIRY;
            
            clearInterval(this.timers.codeExpiry);
            this.timers.codeExpiry = setInterval(() => {
                this.elements.countdown.textContent = Utils.formatTime(timeLeft);
                
                if (timeLeft === 0) {
                    clearInterval(this.timers.codeExpiry);
                    this.verificationCode = '';
                    this.showError('Code expired. Please request a new code.');
                }
                timeLeft--;
            }, 1000);
        }

        startResendTimer() {
            let timeLeft = CONFIG.VERIFICATION.RESEND_COOLDOWN;
            this.elements.resendCodeBtn.disabled = true;
            
            clearInterval(this.timers.resendCooldown);
            this.timers.resendCooldown = setInterval(() => {
                this.elements.resendTimer.textContent = timeLeft;
                
                if (timeLeft === 0) {
                    clearInterval(this.timers.resendCooldown);
                    this.elements.resendCodeBtn.disabled = false;
                }
                timeLeft--;
            }, 1000);
        }

        showError(message) {
            this.elements.status.className = 'verification-status error';
            this.elements.status.textContent = message;
        }

        showSuccess(message) {
            this.elements.status.className = 'verification-status success';
            this.elements.status.textContent = message;
        }

        goBack() {
            this.container.style.display = 'none';
            this.formState.setStep(1);
            document.getElementById('step1').style.display = 'block';
        }

        editPhone() {
            // Reset verification state
            this.resetVerification();
            
            // Clear inputs and messages
            this.elements.phoneInput.value = '';
            this.elements.status.className = 'verification-status';
            this.elements.status.textContent = '';
            
            // Clear all code input fields
            this.elements.codeInputs.forEach(input => {
                input.value = '';
                input.disabled = false;
            });
    
            // Reset timers
            clearInterval(this.timers.codeExpiry);
            clearInterval(this.timers.resendCooldown);
            
            // Reset button states
            this.elements.sendCodeBtn.disabled = true;
            this.elements.sendCodeBtn.classList.remove('active');
            this.elements.resendCodeBtn.disabled = false;
            
            // Switch back to phone input view
            this.elements.codeStep.style.display = 'none';
            this.elements.phoneStep.style.display = 'block';
            
            // Focus on phone input
            this.elements.phoneInput.focus();
        }
    
        resetVerification() {
            // Reset all verification state
            this.verificationCode = '';
            this.attempts = 0;
            this.timers = {
                codeExpiry: null,
                resendCooldown: null
            };
            
            // Clear form state
            this.formState.setPhoneData({
                number: null,
                countryCode: null,
                isVerified: false
            });
        }
    
        // Update sendCode to ensure clean state
        async sendCode() {
            if (!this.validatePhoneNumber(this.elements.phoneInput.value)) {
                return;
            }
    
            // Reset any previous verification state
            this.resetVerification();
            
            Utils.showLoading(this.container);
            
            try {
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                console.log('Verification code:', this.verificationCode);
    
                this.showCodeStep();
                this.startCountdown();
                this.startResendTimer();
            } catch (error) {
                this.showError('Failed to send code. Please try again.');
            } finally {
                Utils.hideLoading(this.container);
            }
        }
    
        // Update handleVerificationSuccess to be more robust
        handleVerificationSuccess() {
            // Clear any previous timers
            clearInterval(this.timers.codeExpiry);
            clearInterval(this.timers.resendCooldown);
            
            this.showSuccess('Phone number verified successfully!');
            
            // Update form state with new verified phone
            this.formState.setPhoneData({
                number: this.elements.phoneInput.value,
                countryCode: this.elements.countryCode.value,
                isVerified: true
            });
    
            // Disable inputs after successful verification
            this.elements.codeInputs.forEach(input => {
                input.disabled = true;
            });
            this.elements.resendCodeBtn.disabled = true;
        }
    
        // Add method to check if currently verifying
        isVerifying() {
            return this.elements.codeStep.style.display === 'block';
        }
    
        // Update validatePhoneNumber to clear previous verification
        validatePhoneNumber(phone) {
            const isValid = CONFIG.VALIDATION.PHONE_REGEX.test(phone);
            
            // If user is entering a new number while verification was in progress
            if (this.isVerifying()) {
                this.resetVerification();
            }
            
            this.elements.sendCodeBtn.disabled = !isValid;
            if (isValid) {
                this.elements.sendCodeBtn.classList.add('active');
            } else {
                this.elements.sendCodeBtn.classList.remove('active');
            }
            
            return isValid;
        }

        resendCode() {
            this.elements.codeInputs.forEach(input => input.value = '');
            this.sendCode();
        }

        lockVerification() {
            this.elements.codeInputs.forEach(input => input.disabled = true);
            this.elements.resendCodeBtn.disabled = true;
            
            setTimeout(() => {
                this.resetVerification();
            }, CONFIG.VERIFICATION.LOCK_DURATION);
        }

        resetVerification() {
            this.verificationCode = '';
            this.attempts = 0;
            this.elements.codeInputs.forEach(input => {
                input.disabled = false;
                input.value = '';
            });
            this.elements.status.className = 'verification-status';
            this.elements.status.textContent = '';
        }
    }

    class PersonalInfoStep {
        constructor(formState) {
            this.formState = formState;
            this.container = document.getElementById('step3');
            this.initializeElements();
            this.bindEvents();
        }
    
        initializeElements() {
            this.elements = {
                form: this.container.querySelector('#personalInfoForm'),
                firstName: this.container.querySelector('#firstName'),
                lastName: this.container.querySelector('#lastName'),
                email: this.container.querySelector('#email'),
                backButton: this.container.querySelector('#backToPhone'),
                submitButton: this.container.querySelector('#submitPersonalInfo'),
                errors: {
                    firstName: this.container.querySelector('#firstNameError'),
                    lastName: this.container.querySelector('#lastNameError'),
                    email: this.container.querySelector('#emailError')
                }
            };
    
            // Initially disable submit button
            this.elements.submitButton.disabled = true;
        }
    
        bindEvents() {
            // Input validation
            ['firstName', 'lastName', 'email'].forEach(field => {
                this.elements[field].addEventListener('input', () => {
                    this.validateField(field);
                    this.updateSubmitButton();
                });
    
                this.elements[field].addEventListener('blur', () => {
                    this.validateField(field);
                });
            });
    
            // Form submission
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this.validateForm()) {
                    this.handleSubmit();
                }
            });
    
            // Back button
            this.elements.backButton.addEventListener('click', () => {
                this.goBack();
            });
        }

        checkFormValidity() {
            const firstName = this.elements.firstName.value.trim();
            const lastName = this.elements.lastName.value.trim();
            const email = this.elements.email.value.trim();
        
            // Check if all fields have values and email is valid
            const isValid = firstName !== '' && 
                           lastName !== '' && 
                           email !== '' && 
                           this.validateEmail(email);
        
            // Update button state
            if (isValid) {
                this.elements.submitButton.classList.add('active');
                this.elements.submitButton.disabled = false;
            } else {
                this.elements.submitButton.classList.remove('active');
                this.elements.submitButton.disabled = true;
            }
        }
    
        validateField(fieldName) {
            const value = this.elements[fieldName].value.trim();
            let isValid = true;
            let errorMessage = '';
    
            switch(fieldName) {
                case 'firstName':
                case 'lastName':
                    if (!value) {
                        isValid = false;
                        errorMessage = `Please enter your ${fieldName === 'firstName' ? 'first' : 'last'} name`;
                    } else if (value.length < 2) {
                        isValid = false;
                        errorMessage = 'Must be at least 2 characters';
                    }
                    break;
    
                case 'email':
                    if (!value) {
                        isValid = false;
                        errorMessage = 'Please enter your email address';
                    } else if (!this.validateEmail(value)) {
                        isValid = false;
                        errorMessage = 'Please enter a valid email address';
                    }
                    break;
            }
    
            this.showFieldError(fieldName, !isValid, errorMessage);
            return isValid;
        }
    
        validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }
    
        showFieldError(fieldName, hasError, message = '') {
            const field = this.elements[fieldName];
            const errorElement = this.elements.errors[fieldName];
    
            if (hasError) {
                field.classList.add('error');
                errorElement.textContent = message;
                errorElement.style.display = 'block';
            } else {
                field.classList.remove('error');
                errorElement.style.display = 'none';
            }
        }
    
        validateForm() {
            return ['firstName', 'lastName', 'email'].every(field => 
                this.validateField(field));
        }
    
        updateSubmitButton() {
            const isValid = this.validateForm();
            this.elements.submitButton.disabled = !isValid;
            
            // Add or remove active class based on validation
            if (isValid) {
                this.elements.submitButton.classList.add('active');
            } else {
                this.elements.submitButton.classList.remove('active');
            }
        }
    
        handleSubmit() {
            const formData = {
                firstName: this.elements.firstName.value.trim(),
                lastName: this.elements.lastName.value.trim(),
                email: this.elements.email.value.trim()
            };
    
            this.formState.setPersonalInfo(formData);
            // Proceed to next step (email verification)
            this.formState.setStep(4);
        }
    
        goBack() {
            this.container.style.display = 'none';
            this.formState.setStep(2);
            document.getElementById('step2').style.display = 'block';
        }
    }

    // Initialize Application
    class RegistrationApp {
        constructor() {
            this.formState = new FormState();
            this.steps = {
                accountType: new AccountTypeSelector(this.formState),
                phoneVerification: new PhoneVerification(this.formState),
                personalInfo: new PersonalInfoStep(this.formState)  // Add this line
            };
            
            this.bindStateListeners();
        }
    
        bindStateListeners() {
            this.formState.subscribe('step', (data) => {
                this.handleStepChange(data.currentStep);
            });
    
            this.formState.subscribe('phone', (data) => {
                if (data.phone.isVerified) {
                    // When phone is verified, move to personal info
                    this.formState.setStep(3);
                }
            });
        }
    
        handleStepChange(step) {
            // Hide all steps
            document.querySelectorAll('.form-step, .phone-verification, .personal-info')
                .forEach(s => s.style.display = 'none');
    
            // Show current step
            switch(step) {
                case 1:
                    document.getElementById('step1').style.display = 'block';
                    break;
                case 2:
                    document.getElementById('step2').style.display = 'block';
                    break;
                case 3:
                    document.getElementById('step3').style.display = 'block';
                    break;
            }
        }
    }
    // Start the application
    window.app = new RegistrationApp();
});